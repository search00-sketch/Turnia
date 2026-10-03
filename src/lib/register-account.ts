import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { firebaseErrorMessage } from "@/lib/firebase-errors";
import { normalizeEmail } from "@/lib/email-typos";

export const EMAIL_TAKEN_MESSAGE =
  "Ya existe una cuenta con ese email. Si es tuya, ingresá desde \"Iniciar sesión\". Si querés una cuenta aparte con " +
  "el mismo Gmail, usá un alias: por ejemplo tunombre+negocio@gmail.com (los mails te llegan igual).";

/**
 * Crea la cuenta de Firebase para un registro. Si el email ya existe y la
 * contraseña coincide, reutiliza esa cuenta: así se puede completar un
 * registro que quedó a medias (cuenta creada, pero sin perfil guardado).
 */
export async function getOrCreateAuthAccount(
  rawEmail: string,
  password: string
): Promise<{ ok: true; user: User; createdNow: boolean } | { ok: false; error: string }> {
  const auth = getFirebaseAuth();
  const email = normalizeEmail(rawEmail);
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    return { ok: true, user: credential.user, createdNow: true };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== "auth/email-already-in-use") return { ok: false, error: firebaseErrorMessage(code) };
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return { ok: true, user: credential.user, createdNow: false };
  } catch {
    return { ok: false, error: EMAIL_TAKEN_MESSAGE };
  }
}

/** Deshace el alta si el registro falló, para que el email quede libre para reintentar. */
export async function rollbackAuthAccount(user: User, createdNow: boolean): Promise<void> {
  if (createdNow) {
    await user.delete().catch(() => {});
  }
  await signOut(getFirebaseAuth()).catch(() => {});
}

const GOOGLE_ERRORS: Record<string, string> = {
  "auth/popup-closed-by-user": "Cerraste la ventana de Google antes de terminar.",
  "auth/cancelled-popup-request": "Cerraste la ventana de Google antes de terminar.",
  "auth/popup-blocked": "El navegador bloqueó la ventana de Google. Permití las ventanas emergentes para este sitio y probá de nuevo.",
  "auth/operation-not-allowed": "El ingreso con Google todavía no está habilitado. Usá email y contraseña.",
  "auth/unauthorized-domain": "El ingreso con Google todavía no está habilitado para este sitio. Usá email y contraseña.",
};

/** Abre la ventana de Google para elegir la cuenta. Las cuentas de Google ya vienen con el email confirmado. */
export async function signInWithGoogle(): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const credential = await signInWithPopup(getFirebaseAuth(), provider);
    return { ok: true, user: credential.user };
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    return { ok: false, error: GOOGLE_ERRORS[code] ?? firebaseErrorMessage(code) };
  }
}

/**
 * Manda (o reenvía) el mail de confirmación. El link vuelve a /login de este
 * sitio; si el dominio no está autorizado en Firebase, se manda igual con la
 * página de confirmación por defecto de Firebase.
 */
export async function sendVerificationEmail(user: User): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await sendEmailVerification(user, { url: `${window.location.origin}/login?verificado=1` });
    return { ok: true };
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    if (code === "auth/unauthorized-continue-uri" || code === "auth/invalid-continue-uri") {
      try {
        await sendEmailVerification(user);
        return { ok: true };
      } catch (retryErr) {
        return { ok: false, error: firebaseErrorMessage((retryErr as { code?: string })?.code) };
      }
    }
    return { ok: false, error: firebaseErrorMessage(code) };
  }
}

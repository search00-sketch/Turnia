import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { firebaseErrorMessage } from "@/lib/firebase-errors";

export const EMAIL_TAKEN_MESSAGE =
  "Ya existe una cuenta con ese email. Si es tuya, ingresá desde \"Iniciar sesión\". Si querés una cuenta aparte con " +
  "el mismo Gmail, usá un alias: por ejemplo tunombre+negocio@gmail.com (los mails te llegan igual).";

/**
 * Crea la cuenta de Firebase para un registro. Si el email ya existe y la
 * contraseña coincide, reutiliza esa cuenta: así se puede completar un
 * registro que quedó a medias (cuenta creada, pero sin perfil guardado).
 */
export async function getOrCreateAuthAccount(
  email: string,
  password: string
): Promise<{ ok: true; user: User; createdNow: boolean } | { ok: false; error: string }> {
  const auth = getFirebaseAuth();
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

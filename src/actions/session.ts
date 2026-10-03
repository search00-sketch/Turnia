"use server";

import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase-admin";
import { getUserByUid } from "@/lib/db/users";
import { SESSION_COOKIE_MAX_AGE_MS, SESSION_COOKIE_NAME } from "@/lib/session-constants";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Código de error de createSessionCookie cuando falta confirmar el email. */
const EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED";

export type SessionResult =
  | { ok: true; hasProfile: boolean; role: "CLIENTE" | "NEGOCIO" | "ADMIN" | null }
  | { ok: false; error: string };

/**
 * Cambia un ID token de Firebase (de corta duración, del cliente) por una cookie
 * de sesión httpOnly (de larga duración) que el servidor puede verificar en cada
 * request sin volver a hablar con Firebase desde el navegador.
 */
export async function createSessionCookie(idToken: string): Promise<SessionResult> {
  try {
    const auth = getAdminAuth();
    // Verificamos el token antes de confiar en él (evita que cualquiera mande un
    // token trucho e intente que le generemos una cookie de sesión).
    const decoded = await auth.verifyIdToken(idToken);

    // Cuentas nuevas de email y contraseña: sin email confirmado no hay sesión.
    const profile = await getUserByUid(decoded.uid);
    if (profile?.requiresEmailVerification && decoded.email_verified !== true) {
      return { ok: false, error: EMAIL_NOT_VERIFIED };
    }

    const cookieValue = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_COOKIE_MAX_AGE_MS,
    });

    cookies().set(SESSION_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE_MS / 1000,
    });

    // Una cuenta de Firebase sin perfil en Firestore es un registro que quedó a
    // medias: el login lo avisa para que se complete desde el registro.
    return { ok: true, hasProfile: Boolean(profile), role: profile?.role ?? null };
  } catch (err) {
    console.error("No se pudo crear la sesión", err);
    return { ok: false, error: "No pudimos iniciar tu sesión. Probá de nuevo." };
  }
}

export async function clearSessionCookie(): Promise<void> {
  cookies().delete(SESSION_COOKIE_NAME);
}

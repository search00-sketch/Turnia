"use server";

import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase-admin";
import { SESSION_COOKIE_MAX_AGE_MS, SESSION_COOKIE_NAME } from "@/lib/session-constants";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Cambia un ID token de Firebase (de corta duración, del cliente) por una cookie
 * de sesión httpOnly (de larga duración) que el servidor puede verificar en cada
 * request sin volver a hablar con Firebase desde el navegador.
 */
export async function createSessionCookie(idToken: string): Promise<ActionResult> {
  try {
    const auth = getAdminAuth();
    // Verificamos el token antes de confiar en él (evita que cualquiera mande un
    // token trucho e intente que le generemos una cookie de sesión).
    await auth.verifyIdToken(idToken);

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

    return { ok: true };
  } catch (err) {
    console.error("No se pudo crear la sesión", err);
    return { ok: false, error: "No pudimos iniciar tu sesión. Probá de nuevo." };
  }
}

export async function clearSessionCookie(): Promise<void> {
  cookies().delete(SESSION_COOKIE_NAME);
}

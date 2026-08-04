import { cookies } from "next/headers";
import { getAdminAuth } from "./firebase-admin";
import { prisma } from "./prisma";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE_MS } from "./session-constants";

export { SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE_MS };

/** Usuario autenticado actual (con su negocio, si es dueño de uno), o null si no hay sesión válida. */
export async function getCurrentUser() {
  const sessionCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      include: { business: true },
    });
    return user;
  } catch {
    return null;
  }
}

/** Devuelve el usuario sólo si es dueño de un negocio (rol NEGOCIO con business asociado). */
export async function requireBusinessUser() {
  const user = await getCurrentUser();
  if (!user || user.role !== "NEGOCIO" || !user.business) return null;
  return user;
}

/** Devuelve el usuario sólo si es un cliente. */
export async function requireClientUser() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CLIENTE") return null;
  return user;
}

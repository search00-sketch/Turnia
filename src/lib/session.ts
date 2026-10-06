import { cookies } from "next/headers";
import { getAdminAuth } from "./firebase-admin";
import { getUserByUid } from "./db/users";
import { getBusinessByOwnerId } from "./db/businesses";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE_MS } from "./session-constants";

export { SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE_MS };

/** Usuario autenticado actual (con su negocio, si es dueño de uno), o null si no hay sesión válida. */
export async function getCurrentUser() {
  const sessionCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const user = await getUserByUid(decoded.uid);
    if (!user) return null;
    const business = await getBusinessByOwnerId(user.id);
    return { ...user, business };
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

/**
 * Devuelve el usuario si puede reservar y tener "Mis turnos": clientes y
 * dueños de negocio (un dueño también puede reservar en otros lugares).
 */
export async function requireClientUser() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "CLIENTE" && user.role !== "NEGOCIO")) return null;
  return user;
}

/** Devuelve el usuario sólo si es administrador de la plataforma. */
export async function requireAdminUser() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

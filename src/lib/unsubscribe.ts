import { createHmac, timingSafeEqual } from "node:crypto";

// Link de desuscripción firmado: "<uid en base64url>.<firma>". Sólo quien
// recibió el mail tiene el link, y nadie puede armar uno para otra persona
// sin el secreto del servidor.

function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || process.env.FIREBASE_PRIVATE_KEY;
  if (!s) throw new Error("Falta UNSUBSCRIBE_SECRET (o CRON_SECRET) para firmar los links de desuscripción.");
  return s;
}

function sign(uid: string): string {
  return createHmac("sha256", secret()).update(`unsubscribe:${uid}`).digest("base64url").slice(0, 32);
}

export function unsubscribeToken(uid: string): string {
  return `${Buffer.from(uid).toString("base64url")}.${sign(uid)}`;
}

/** Devuelve el uid si el token es válido, o null. */
export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const uid = Buffer.from(encoded, "base64url").toString();
  const expected = sign(uid);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? uid : null;
}

/** URL pública de la app, para los links que van en los mails. */
export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

/** Página con el botón para confirmar la desuscripción (link del pie del mail). */
export function unsubscribePageUrl(uid: string): string {
  return `${appUrl()}/desuscribirse?t=${unsubscribeToken(uid)}`;
}

/** Desuscripción con un clic (encabezado List-Unsubscribe, la usan Gmail y Yahoo). */
export function oneClickUnsubscribeUrl(uid: string): string {
  return `${appUrl()}/api/unsubscribe?t=${unsubscribeToken(uid)}`;
}

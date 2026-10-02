import "./timezone";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * La clave privada llega con formatos distintos según de dónde salga: con "\n"
 * literales (como en .env.example), con saltos de línea reales, con comillas
 * de más, con barras duplicadas ("\\n", como la deja `vercel env pull`), con
 * espacios en lugar de saltos de línea, o incluso con el JSON entero de la
 * cuenta de servicio pegado. En vez de adivinar cada caso, se toma lo que está
 * entre "-----BEGIN ...-----" y "-----END ...-----", se queda sólo con los
 * caracteres base64 y se rearma el PEM con el formato estándar.
 */
export function normalizePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  const match = raw.match(/-----BEGIN ([A-Z ]*PRIVATE KEY)-----([\s\S]*?)-----END \1-----/);
  if (!match) return raw;
  const body = match[2]
    .replace(/\\+[nr]/g, "") // "\n" / "\\n" escritos como texto
    .replace(/[^A-Za-z0-9+/=]/g, ""); // saltos de línea, espacios, comillas, barras sueltas
  const lines = body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${match[1]}-----\n${lines.join("\n")}\n-----END ${match[1]}-----\n`;
}

/** Descripción de la forma de la clave para diagnosticar errores, sin mostrar su contenido. */
function describePrivateKey(raw: string): string {
  const hasBegin = /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(raw);
  const hasEnd = /-----END [A-Z ]*PRIVATE KEY-----/.test(raw);
  const odd = Array.from(new Set(raw.replace(/-----(BEGIN|END) [A-Z ]*PRIVATE KEY-----/g, "").match(/[^A-Za-z0-9+/=]/g) ?? []))
    .map((c) => JSON.stringify(c))
    .join(" ");
  const base64Len = (normalizePrivateKey(raw) ?? "").replace(/-----[^-]+-----|\n/g, "").length;
  return (
    `largo ${raw.length}, empieza con ${JSON.stringify(raw.slice(0, 12))}, ` +
    `encabezado BEGIN: ${hasBegin ? "sí" : "NO"}, pie END: ${hasEnd ? "sí" : "NO"}, ` +
    `caracteres base64 del cuerpo: ${base64Len} (una clave normal tiene ~1620), ` +
    `otros caracteres presentes: ${odd || "ninguno"}`
  );
}

// El SDK de administración corre sólo en el servidor (Node.js), nunca en el navegador
// ni en middleware (que corre en el runtime Edge, sin soporte para este SDK).
function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Faltan variables de entorno de Firebase Admin: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y/o FIREBASE_PRIVATE_KEY. " +
        "Revisá tu .env (ver .env.example)."
    );
  }

  if (process.env.FIREBASE_PRIVATE_KEY!.trim() === "[SENSITIVE]") {
    throw new Error(
      "FIREBASE_PRIVATE_KEY dice \"[SENSITIVE]\": así la deja `vercel env pull` cuando la variable está marcada como " +
        "sensible en Vercel (no baja el valor real). Generá una clave en Firebase > Configuración del proyecto > " +
        "Cuentas de servicio y copiá el campo private_key en tu .env."
    );
  }

  let credential;
  try {
    credential = cert({ projectId, clientEmail, privateKey });
  } catch (err) {
    throw new Error(
      `FIREBASE_PRIVATE_KEY no es una clave privada válida (${describePrivateKey(process.env.FIREBASE_PRIVATE_KEY!)}). ` +
        "Generá una nueva en Firebase > Configuración del proyecto > Cuentas de servicio y copiá el campo private_key. " +
        `Error original: ${(err as Error).message}`
    );
  }

  return initializeApp({ credential });
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

const globalForFirebase = globalThis as unknown as {
  firestoreDb?: Firestore;
};

export function getAdminDb(): Firestore {
  if (globalForFirebase.firestoreDb) {
    return globalForFirebase.firestoreDb;
  }

  const db = getFirestore(getAdminApp());
  // Los Server Actions pasan campos opcionales como `undefined` (vía Zod
  // `.optional()`) cuando el usuario no los completó. Sin esto, Firestore
  // tira error al escribir un `undefined`. Con esto, el campo se omite del
  // write (no se toca), igual que hace Prisma con `undefined` en `update`.
  db.settings({ ignoreUndefinedProperties: true });

  globalForFirebase.firestoreDb = db;

  return db;
}

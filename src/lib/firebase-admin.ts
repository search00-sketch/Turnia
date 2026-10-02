import "./timezone";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * La clave privada llega con formatos distintos según de dónde salga: con "\n"
 * literales (como en .env.example), con saltos de línea reales, con comillas
 * de más si se pegaron junto con el valor, o con barras duplicadas ("\\n") como
 * la deja `vercel env pull`. El cuerpo de una clave PEM es base64 (nunca tiene
 * barras invertidas ni comillas), así que se pueden limpiar sin riesgo.
 */
export function normalizePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  // Uno o más "\" seguidos de "n" → salto de línea; "\" sueltas antes de un salto real → afuera.
  let key = raw.replace(/\\+n/g, "\n").replace(/\\+\r?\n/g, "\n").replace(/\r\n/g, "\n");
  // Comillas envolviendo el valor (sueltas o escapadas: "...", \"...\") y barras sueltas en los bordes.
  key = key.trim().replace(/^(\\?["'])+/, "").replace(/(\\?["'])+$/, "").replace(/\\+$/, "");
  return key.trim() + "\n";
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

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
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

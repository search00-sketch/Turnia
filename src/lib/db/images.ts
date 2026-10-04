import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";

// Las fotos (portada del negocio, foto de cada profesional) se guardan en
// Firestore como base64, ya achicadas en el navegador, para no depender de
// Cloud Storage (que pide el plan pago). Van en una colección aparte —nunca
// dentro del documento del negocio— para que listar negocios no descargue
// las fotos, y se sirven por /api/images/{id} con caché de un año: cada foto
// nueva tiene un id nuevo, así que la caché nunca muestra una foto vieja.

export type ImageKind = "cover" | "professional";

/** Tamaño máximo de una foto ya comprimida (el documento de Firestore admite hasta 1 MiB). */
export const MAX_IMAGE_BYTES = 400 * 1024;

const DATA_URL_RE = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/;

export interface ImageDoc {
  id: string;
  businessId: string;
  kind: ImageKind;
  contentType: string;
  data: string; // base64
}

/** Valida un data URL de imagen y devuelve tipo, base64 y tamaño real; null si no es válido. */
export function parseImageDataUrl(dataUrl: string): { contentType: string; data: string; bytes: number } | null {
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) return null;
  const data = match[2];
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return { contentType: match[1], data, bytes: (data.length * 3) / 4 - padding };
}

export function imageUrl(id: string): string {
  return `/api/images/${id}`;
}

/** Id de la foto si la URL guardada es una de las nuestras ("/api/images/{id}"). */
export function imageIdFromUrl(url: string | null | undefined): string | null {
  const match = url ? /^\/api\/images\/([A-Za-z0-9]+)$/.exec(url) : null;
  return match ? match[1] : null;
}

export async function saveImage(input: {
  businessId: string;
  kind: ImageKind;
  contentType: string;
  data: string;
}): Promise<string> {
  const ref = await getAdminDb()
    .collection(COLLECTIONS.images)
    .add({ ...input, createdAt: new Date() });
  return ref.id;
}

export async function getImage(id: string): Promise<ImageDoc | null> {
  const snap = await getAdminDb().collection(COLLECTIONS.images).doc(id).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return { id: snap.id, businessId: d.businessId, kind: d.kind, contentType: d.contentType, data: d.data };
}

/** Borra la foto sólo si pertenece al negocio indicado. */
export async function deleteImageOfBusiness(id: string, businessId: string): Promise<void> {
  const ref = getAdminDb().collection(COLLECTIONS.images).doc(id);
  const snap = await ref.get();
  if (snap.exists && snap.data()!.businessId === businessId) await ref.delete();
}

import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";

/**
 * Un negocio sólo se muestra en el marketplace si se le puede reservar un
 * turno: tiene al menos un servicio activo y un profesional activo.
 * Devuelve, para los negocios que cumplen eso, el precio más bajo de sus
 * servicios ("desde $") — sale de la misma lectura, sin consultas extra.
 */
export async function getBookableInfo(businessIds: string[]): Promise<Map<string, { minPrice: number }>> {
  const out = new Map<string, { minPrice: number }>();
  if (businessIds.length === 0) return out;
  const db = getAdminDb();
  const chunks: string[][] = [];
  for (let i = 0; i < businessIds.length; i += 30) chunks.push(businessIds.slice(i, i + 30));

  const query = (collection: string, fields: string[]) =>
    Promise.all(
      chunks.map((chunk) =>
        db.collection(collection).where("businessId", "in", chunk).where("active", "==", true).select(...fields).get()
      )
    ).then((snaps) => snaps.flatMap((s) => s.docs.map((d) => d.data())));

  const [services, professionals] = await Promise.all([
    query(COLLECTIONS.services, ["businessId", "price"]),
    query(COLLECTIONS.professionals, ["businessId"]),
  ]);

  const withProfessionals = new Set(professionals.map((p) => p.businessId as string));
  for (const s of services) {
    const id = s.businessId as string;
    if (!withProfessionals.has(id)) continue;
    const price = Number(s.price) || 0;
    const current = out.get(id);
    if (!current || price < current.minPrice) out.set(id, { minPrice: price });
  }
  return out;
}

export async function getBookableBusinessIds(businessIds: string[]): Promise<Set<string>> {
  return new Set((await getBookableInfo(businessIds)).keys());
}

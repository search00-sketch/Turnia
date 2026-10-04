import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";

/**
 * Un negocio sólo se muestra en el marketplace si se le puede reservar un
 * turno: tiene al menos un servicio activo y un profesional activo.
 * Devuelve cuáles de los negocios dados cumplen eso (consultas 'in' de a 30).
 */
export async function getBookableBusinessIds(businessIds: string[]): Promise<Set<string>> {
  if (businessIds.length === 0) return new Set();
  const db = getAdminDb();
  const chunks: string[][] = [];
  for (let i = 0; i < businessIds.length; i += 30) chunks.push(businessIds.slice(i, i + 30));

  const withActive = async (collection: string) => {
    const snaps = await Promise.all(
      chunks.map((chunk) =>
        db.collection(collection).where("businessId", "in", chunk).where("active", "==", true).select("businessId").get()
      )
    );
    return new Set(snaps.flatMap((s) => s.docs.map((d) => d.data().businessId as string)));
  };

  const [withServices, withProfessionals] = await Promise.all([
    withActive(COLLECTIONS.services),
    withActive(COLLECTIONS.professionals),
  ]);
  return new Set(businessIds.filter((id) => withServices.has(id) && withProfessionals.has(id)));
}

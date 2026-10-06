import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { getBusinessById, type BusinessDoc } from "@/lib/db/businesses";
import { mapAppointmentDoc, type AppointmentDoc } from "@/lib/db/appointments";

// Colecciones que guardan datos de un negocio con el campo businessId.
const CHILD_COLLECTIONS = [
  COLLECTIONS.appointments,
  COLLECTIONS.services,
  COLLECTIONS.professionals,
  COLLECTIONS.businessHours,
  COLLECTIONS.movements,
  COLLECTIONS.images,
] as const;

/** Firestore admite hasta 500 escrituras por batch. */
const BATCH_SIZE = 400;

async function deleteRefs(refs: FirebaseFirestore.DocumentReference[]): Promise<void> {
  const db = getAdminDb();
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + BATCH_SIZE)) batch.delete(ref);
    await batch.commit();
  }
}

/**
 * Borra un negocio y todo lo suyo: turnos, servicios, profesionales, horarios,
 * movimientos contables, fotos y su slug. El dueño NO se borra: su cuenta
 * vuelve a ser de cliente (conserva sus turnos en otros negocios).
 *
 * Primero se borran los datos y al final el negocio, así si algo falla a
 * mitad de camino el negocio sigue apareciendo en el admin y se puede
 * reintentar. Devuelve los turnos futuros activos que se cancelaron, para
 * avisarles a los clientes (con el nombre de cada servicio, que ya no existe).
 */
export async function deleteBusinessCascade(
  businessId: string
): Promise<{
  business: BusinessDoc;
  cancelledUpcoming: AppointmentDoc[];
  serviceNames: Record<string, string>;
} | null> {
  const db = getAdminDb();
  const business = await getBusinessById(businessId);
  if (!business) return null;

  const snaps = await Promise.all(
    CHILD_COLLECTIONS.map((c) => db.collection(c).where("businessId", "==", businessId).get())
  );

  const now = new Date();
  const cancelledUpcoming = snaps[0].docs
    .map(mapAppointmentDoc)
    .filter((a) => a.startsAt >= now && (a.status === "PENDIENTE" || a.status === "CONFIRMADO"));
  const serviceNames = Object.fromEntries(snaps[1].docs.map((d) => [d.id, String(d.data().name ?? "")]));

  await deleteRefs(snaps.flatMap((s) => s.docs.map((d) => d.ref)));

  const batch = db.batch();
  const slugRef = db.collection(COLLECTIONS.businessSlugs).doc(business.slug);
  const slugSnap = await slugRef.get();
  if (slugSnap.exists && slugSnap.data()?.businessId === businessId) batch.delete(slugRef);

  const ownerRef = db.collection(COLLECTIONS.users).doc(business.ownerId);
  const ownerSnap = await ownerRef.get();
  if (ownerSnap.exists && ownerSnap.data()?.role === "NEGOCIO") batch.update(ownerRef, { role: "CLIENTE" });

  batch.delete(db.collection(COLLECTIONS.businesses).doc(businessId));
  await batch.commit();

  return { business, cancelledUpcoming, serviceNames };
}

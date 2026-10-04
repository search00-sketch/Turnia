import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";

export interface BusinessHourDoc {
  businessId: string;
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

function hourDocId(businessId: string, dayOfWeek: number): string {
  return `${businessId}__${dayOfWeek}`;
}

export function mapHourDoc(snap: FirebaseFirestore.DocumentSnapshot): BusinessHourDoc {
  const data = snap.data()!;
  return {
    businessId: data.businessId,
    dayOfWeek: data.dayOfWeek,
    isClosed: data.isClosed,
    openTime: data.openTime ?? null,
    closeTime: data.closeTime ?? null,
  };
}

export async function getHoursByBusiness(businessId: string): Promise<BusinessHourDoc[]> {
  const snap = await getAdminDb()
    .collection(COLLECTIONS.businessHours)
    .where("businessId", "==", businessId)
    .get();
  const hours = snap.docs.map(mapHourDoc);
  hours.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  return hours;
}

// Doc ID determinístico: reproduce la constraint única de Prisma
// (@@unique([businessId, dayOfWeek])) como upsert natural vía set().
export function hourRef(businessId: string, dayOfWeek: number): FirebaseFirestore.DocumentReference {
  return getAdminDb().collection(COLLECTIONS.businessHours).doc(hourDocId(businessId, dayOfWeek));
}

export async function upsertHours(
  businessId: string,
  days: Omit<BusinessHourDoc, "businessId">[]
): Promise<void> {
  const batch = getAdminDb().batch();
  for (const day of days) {
    batch.set(hourRef(businessId, day.dayOfWeek), { businessId, ...day });
  }
  await batch.commit();
}

/** Horarios de varios negocios a la vez (consultas 'in' de a 30), agrupados por negocio. */
export async function getHoursForBusinesses(businessIds: string[]): Promise<Map<string, BusinessHourDoc[]>> {
  const out = new Map<string, BusinessHourDoc[]>();
  if (businessIds.length === 0) return out;
  const db = getAdminDb();
  const chunks: string[][] = [];
  for (let i = 0; i < businessIds.length; i += 30) chunks.push(businessIds.slice(i, i + 30));
  const snaps = await Promise.all(
    chunks.map((chunk) => db.collection(COLLECTIONS.businessHours).where("businessId", "in", chunk).get())
  );
  for (const doc of snaps.flatMap((s) => s.docs)) {
    const h = mapHourDoc(doc);
    out.set(h.businessId, [...(out.get(h.businessId) ?? []), h]);
  }
  return out;
}

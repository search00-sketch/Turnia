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

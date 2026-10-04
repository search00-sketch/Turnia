import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";

export interface ProfessionalDoc {
  id: string;
  businessId: string;
  name: string;
  photo: string | null;
  active: boolean;
}

export function mapProfessionalDoc(snap: FirebaseFirestore.DocumentSnapshot): ProfessionalDoc {
  const data = snap.data()!;
  return {
    id: snap.id,
    businessId: data.businessId,
    name: data.name,
    photo: data.photo ?? null,
    active: data.active,
  };
}

export async function getProfessionalsByBusiness(
  businessId: string,
  opts: { activeOnly?: boolean } = {}
): Promise<ProfessionalDoc[]> {
  let query: FirebaseFirestore.Query = getAdminDb()
    .collection(COLLECTIONS.professionals)
    .where("businessId", "==", businessId);
  if (opts.activeOnly) query = query.where("active", "==", true);
  const snap = await query.get();
  const professionals = snap.docs.map(mapProfessionalDoc);
  professionals.sort((a, b) => a.name.localeCompare(b.name));
  return professionals;
}

export async function getProfessionalById(id: string): Promise<ProfessionalDoc | null> {
  const snap = await getAdminDb().collection(COLLECTIONS.professionals).doc(id).get();
  return snap.exists ? mapProfessionalDoc(snap) : null;
}

export async function createProfessional(businessId: string, data: { name: string }): Promise<void> {
  await getAdminDb().collection(COLLECTIONS.professionals).add({
    businessId,
    name: data.name,
    photo: null,
    active: true,
  });
}

export async function updateProfessional(
  id: string,
  data: Partial<{ name: string; active: boolean; photo: string | null }>
): Promise<void> {
  await getAdminDb().collection(COLLECTIONS.professionals).doc(id).update(data);
}

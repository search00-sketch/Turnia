import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";

export interface ServiceDoc {
  id: string;
  businessId: string;
  category: string;
  name: string;
  description: string | null;
  price: number;
  /** Costo directo estimado de cada turno de este servicio (insumos, comisión, etc.). */
  cost: number;
  durationMin: number;
  active: boolean;
}

export function mapServiceDoc(snap: FirebaseFirestore.DocumentSnapshot): ServiceDoc {
  const data = snap.data()!;
  return {
    id: snap.id,
    businessId: data.businessId,
    category: data.category,
    name: data.name,
    description: data.description ?? null,
    price: data.price,
    cost: data.cost ?? 0,
    durationMin: data.durationMin,
    active: data.active,
  };
}

export async function getServicesByBusiness(
  businessId: string,
  opts: { activeOnly?: boolean } = {}
): Promise<ServiceDoc[]> {
  let query: FirebaseFirestore.Query = getAdminDb()
    .collection(COLLECTIONS.services)
    .where("businessId", "==", businessId);
  if (opts.activeOnly) query = query.where("active", "==", true);
  const snap = await query.get();
  const services = snap.docs.map(mapServiceDoc);
  services.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  return services;
}

// Usado por la búsqueda de texto del marketplace (hasta 30 ids por query 'in').
export async function getServicesForBusinesses(businessIds: string[]): Promise<ServiceDoc[]> {
  if (businessIds.length === 0) return [];
  const db = getAdminDb();
  const chunks: string[][] = [];
  for (let i = 0; i < businessIds.length; i += 30) {
    chunks.push(businessIds.slice(i, i + 30));
  }
  const results = await Promise.all(
    chunks.map((chunk) => db.collection(COLLECTIONS.services).where("businessId", "in", chunk).get())
  );
  return results.flatMap((snap) => snap.docs.map(mapServiceDoc));
}

export async function getServiceById(id: string): Promise<ServiceDoc | null> {
  const snap = await getAdminDb().collection(COLLECTIONS.services).doc(id).get();
  return snap.exists ? mapServiceDoc(snap) : null;
}

export async function createService(
  businessId: string,
  data: { category: string; name: string; description?: string; price: number; cost?: number; durationMin: number }
): Promise<void> {
  await getAdminDb()
    .collection(COLLECTIONS.services)
    .add({
      businessId,
      category: data.category,
      name: data.name,
      description: data.description ?? null,
      price: data.price,
      cost: data.cost ?? 0,
      durationMin: data.durationMin,
      active: true,
    });
}

export async function updateService(
  id: string,
  data: Partial<{
    category: string;
    name: string;
    description: string;
    price: number;
    cost: number;
    durationMin: number;
    active: boolean;
  }>
): Promise<void> {
  await getAdminDb().collection(COLLECTIONS.services).doc(id).update(data);
}

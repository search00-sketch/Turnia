import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { hourRef } from "@/lib/db/hours";

export interface BusinessDoc {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  coverImage: string | null;
  published: boolean;
  ownerId: string;
  createdAt: Date;
}

export function mapBusinessDoc(snap: FirebaseFirestore.DocumentSnapshot): BusinessDoc {
  const data = snap.data()!;
  return {
    id: snap.id,
    slug: data.slug,
    name: data.name,
    category: data.category,
    description: data.description ?? null,
    address: data.address ?? null,
    phone: data.phone ?? null,
    whatsapp: data.whatsapp ?? null,
    coverImage: data.coverImage ?? null,
    published: data.published,
    ownerId: data.ownerId,
    createdAt: data.createdAt.toDate(),
  };
}

export async function getBusinessById(id: string): Promise<BusinessDoc | null> {
  const snap = await getAdminDb().collection(COLLECTIONS.businesses).doc(id).get();
  return snap.exists ? mapBusinessDoc(snap) : null;
}

export async function getBusinessBySlug(slug: string): Promise<BusinessDoc | null> {
  const snap = await getAdminDb()
    .collection(COLLECTIONS.businesses)
    .where("slug", "==", slug)
    .limit(1)
    .get();
  return snap.empty ? null : mapBusinessDoc(snap.docs[0]);
}

export async function getBusinessByOwnerId(ownerId: string): Promise<BusinessDoc | null> {
  const snap = await getAdminDb()
    .collection(COLLECTIONS.businesses)
    .where("ownerId", "==", ownerId)
    .limit(1)
    .get();
  return snap.empty ? null : mapBusinessDoc(snap.docs[0]);
}

export async function getPublishedBusinesses(
  opts: { category?: string; take?: number } = {}
): Promise<BusinessDoc[]> {
  let query: FirebaseFirestore.Query = getAdminDb()
    .collection(COLLECTIONS.businesses)
    .where("published", "==", true);
  if (opts.category) {
    query = query.where("category", "==", opts.category);
  }
  const snap = await query.get();
  const businesses = snap.docs.map(mapBusinessDoc);
  businesses.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return opts.take ? businesses.slice(0, opts.take) : businesses;
}

export async function isSlugTaken(slug: string): Promise<boolean> {
  const snap = await getAdminDb()
    .collection(COLLECTIONS.businesses)
    .where("slug", "==", slug)
    .limit(1)
    .get();
  return !snap.empty;
}

export async function updateBusiness(
  id: string,
  data: Partial<{
    name: string;
    category: string;
    description: string;
    address: string;
    phone: string;
    whatsapp: string;
    coverImage: string;
    published: boolean;
  }>
): Promise<void> {
  await getAdminDb().collection(COLLECTIONS.businesses).doc(id).update(data);
}

/**
 * Crea el usuario dueño + el negocio + sus 7 horarios en un solo batch atómico
 * (reemplaza el nested create de Prisma en registerBusiness).
 */
export async function createBusinessOwnerBatch(input: {
  ownerId: string;
  ownerData: { name: string; lastName?: string; email: string; phone?: string };
  businessData: {
    slug: string;
    name: string;
    category: string;
    description?: string;
    address?: string;
    phone?: string;
    whatsapp?: string;
  };
  hours: { dayOfWeek: number; isClosed: boolean; openTime: string | null; closeTime: string | null }[];
}): Promise<string> {
  const db = getAdminDb();
  const businessRef = db.collection(COLLECTIONS.businesses).doc();
  const batch = db.batch();

  batch.set(db.collection(COLLECTIONS.users).doc(input.ownerId), {
    name: input.ownerData.name,
    lastName: input.ownerData.lastName ?? null,
    email: input.ownerData.email,
    phone: input.ownerData.phone ?? null,
    role: "NEGOCIO",
    createdAt: new Date(),
  });

  batch.set(businessRef, {
    slug: input.businessData.slug,
    name: input.businessData.name,
    category: input.businessData.category,
    description: input.businessData.description ?? null,
    address: input.businessData.address ?? null,
    phone: input.businessData.phone ?? null,
    whatsapp: input.businessData.whatsapp ?? null,
    coverImage: null,
    published: true,
    ownerId: input.ownerId,
    createdAt: new Date(),
  });

  for (const day of input.hours) {
    batch.set(hourRef(businessRef.id, day.dayOfWeek), { businessId: businessRef.id, ...day });
  }

  await batch.commit();
  return businessRef.id;
}

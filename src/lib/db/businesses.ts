import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { hourRef } from "@/lib/db/hours";
import { mapUserDoc, type UserDoc } from "@/lib/db/users";

export interface BusinessDoc {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  address: string | null;
  /** Barrio o localidad, para mostrar en las tarjetas del buscador (ej: "Palermo"). */
  neighborhood: string | null;
  phone: string | null;
  whatsapp: string | null;
  coverImage: string | null;
  published: boolean;
  ownerId: string;
  createdAt: Date;
  /** Hasta cuándo pagó el uso de la plataforma. null = todavía no pagó nada (plan gratis). Se carga a mano desde /admin/negocios — no hay pasarela de pago integrada. */
  paidUntil: Date | null;
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
    neighborhood: data.neighborhood ?? null,
    phone: data.phone ?? null,
    whatsapp: data.whatsapp ?? null,
    coverImage: data.coverImage ?? null,
    published: data.published,
    ownerId: data.ownerId,
    createdAt: data.createdAt.toDate(),
    paidUntil: data.paidUntil ? data.paidUntil.toDate() : null,
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
    neighborhood: string;
    phone: string;
    whatsapp: string;
    coverImage: string | null;
    published: boolean;
    paidUntil: Date | null;
  }>
): Promise<void> {
  await getAdminDb().collection(COLLECTIONS.businesses).doc(id).update(data);
}

export interface BusinessWithOwner extends BusinessDoc {
  owner: UserDoc | null;
}

/**
 * Trae TODOS los negocios (publicados o no, a diferencia del marketplace en lib/db/marketplace.ts)
 * con los datos del dueño hidratados, para /admin/negocios. Uso exclusivo del
 * panel de administración.
 */
export async function getAllBusinessesWithOwners(): Promise<BusinessWithOwner[]> {
  const db = getAdminDb();
  const snap = await db.collection(COLLECTIONS.businesses).get();
  const businesses = snap.docs.map(mapBusinessDoc);
  businesses.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  if (businesses.length === 0) return [];

  const ownerIds = [...new Set(businesses.map((b) => b.ownerId))];
  const ownerSnaps = await db.getAll(...ownerIds.map((id) => db.collection(COLLECTIONS.users).doc(id)));
  const owners = new Map(ownerSnaps.filter((s) => s.exists).map((s) => [s.id, mapUserDoc(s)]));

  return businesses.map((b) => ({ ...b, owner: owners.get(b.ownerId) ?? null }));
}

/** Se lanza cuando otra registración se quedó con el slug entre el chequeo previo y el commit. */
export class SlugTakenError extends Error {}

/**
 * Crea el usuario dueño + el negocio + sus 7 horarios en una transacción atómica
 * (reemplaza el nested create de Prisma en registerBusiness). La unicidad del
 * slug se reserva con tx.create() sobre turnia_businessSlugs/{slug}: Firestore
 * no tiene constraints únicas como Postgres, así que sin esto dos registros
 * concurrentes con el mismo nombre podrían pisarse el slug (el chequeo previo
 * isSlugTaken por sí solo no es atómico). Si el slug ya fue tomado justo antes
 * de este commit, tira SlugTakenError y no crea nada (falla junto todo).
 */
export async function createBusinessOwnerBatch(input: {
  ownerId: string;
  ownerData: { name: string; lastName?: string; email: string; phone?: string; requiresEmailVerification?: boolean };
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
  const slugRef = db.collection(COLLECTIONS.businessSlugs).doc(input.businessData.slug);

  try {
    await db.runTransaction(async (tx) => {
      tx.create(slugRef, { businessId: businessRef.id });

      tx.set(db.collection(COLLECTIONS.users).doc(input.ownerId), {
        name: input.ownerData.name,
        lastName: input.ownerData.lastName ?? null,
        email: input.ownerData.email,
        phone: input.ownerData.phone ?? null,
        role: "NEGOCIO",
        requiresEmailVerification: input.ownerData.requiresEmailVerification ?? false,
        createdAt: new Date(),
      });

      tx.set(businessRef, {
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
        tx.set(hourRef(businessRef.id, day.dayOfWeek), { businessId: businessRef.id, ...day });
      }
    });
  } catch (err) {
    const code = (err as { code?: number }).code;
    // ALREADY_EXISTS: alguien reservó este slug entre el isSlugTaken() previo y este commit.
    if (code === 6) {
      throw new SlugTakenError(`El slug "${input.businessData.slug}" ya está en uso.`);
    }
    throw err;
  }

  return businessRef.id;
}

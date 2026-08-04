import { firebaseDb, FIREBASE_COLLECTIONS } from "@/lib/firebase";

export async function firebaseHealthCheck() {
  try {
    await firebaseDb.collection(FIREBASE_COLLECTIONS.users).limit(1).get();
    return true;
  } catch {
    return false;
  }
}

export async function firebaseSaveUser(user: {
  id: string;
  email: string;
  name: string;
  lastName?: string | null;
  phone?: string | null;
  role?: string;
  passwordHash?: string;
}) {
  await firebaseDb.collection(FIREBASE_COLLECTIONS.users).doc(user.id).set({
    id: user.id,
    email: user.email,
    name: user.name,
    lastName: user.lastName ?? null,
    phone: user.phone ?? null,
    role: user.role ?? "CLIENTE",
    passwordHash: user.passwordHash ?? null,
    createdAt: new Date().toISOString(),
  });
}

export async function firebaseSaveBusiness(business: {
  id: string;
  slug: string;
  name: string;
  category: string;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  ownerId: string;
  ownerEmail: string;
  published: boolean;
}) {
  await firebaseDb.collection(FIREBASE_COLLECTIONS.businesses).doc(business.id).set({
    id: business.id,
    slug: business.slug,
    name: business.name,
    category: business.category,
    description: business.description ?? null,
    address: business.address ?? null,
    phone: business.phone ?? null,
    whatsapp: business.whatsapp ?? null,
    ownerId: business.ownerId,
    ownerEmail: business.ownerEmail,
    published: business.published,
    createdAt: new Date().toISOString(),
  });
}

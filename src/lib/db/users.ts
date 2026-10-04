import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";

export type Role = "CLIENTE" | "NEGOCIO" | "ADMIN";

export interface UserDoc {
  id: string;
  name: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  role: Role;
  /**
   * true para cuentas creadas con email y contraseña desde que existe la
   * confirmación por mail: no pueden iniciar sesión hasta confirmar el email.
   * Las cuentas anteriores (sin el campo) y las de Google no lo requieren.
   */
  requiresEmailVerification: boolean;
  /** Pidió no recibir más mails de Turnia (botón "desuscribirse" o desde Cuenta). */
  emailOptOut: boolean;
  createdAt: Date;
}

export function mapUserDoc(snap: FirebaseFirestore.DocumentSnapshot): UserDoc {
  const data = snap.data()!;
  return {
    id: snap.id,
    name: data.name,
    lastName: data.lastName ?? null,
    email: data.email,
    phone: data.phone ?? null,
    role: data.role,
    requiresEmailVerification: data.requiresEmailVerification === true,
    emailOptOut: data.emailOptOut === true,
    createdAt: data.createdAt.toDate(),
  };
}

export async function getUserByUid(uid: string): Promise<UserDoc | null> {
  const snap = await getAdminDb().collection(COLLECTIONS.users).doc(uid).get();
  return snap.exists ? mapUserDoc(snap) : null;
}

export async function createUser(
  uid: string,
  data: {
    name: string;
    lastName?: string;
    email: string;
    phone?: string;
    role: Role;
    requiresEmailVerification?: boolean;
  }
): Promise<void> {
  await getAdminDb()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .set({
      name: data.name,
      lastName: data.lastName ?? null,
      email: data.email,
      phone: data.phone ?? null,
      role: data.role,
      requiresEmailVerification: data.requiresEmailVerification ?? false,
      createdAt: new Date(),
    });
}

export async function setEmailOptOut(uid: string, optOut: boolean): Promise<void> {
  await getAdminDb().collection(COLLECTIONS.users).doc(uid).update({ emailOptOut: optOut, emailOptOutAt: new Date() });
}

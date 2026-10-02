import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { mapBusinessDoc, type BusinessDoc } from "@/lib/db/businesses";
import { mapServiceDoc, type ServiceDoc } from "@/lib/db/services";
import { mapProfessionalDoc, type ProfessionalDoc } from "@/lib/db/professionals";
import { mapUserDoc, type UserDoc } from "@/lib/db/users";
import { generateAvailableSlots, type BusinessHourLike } from "@/lib/slots";

export type AppointmentStatus = "PENDIENTE" | "CONFIRMADO" | "CANCELADO" | "COMPLETADO";

export interface AppointmentDoc {
  id: string;
  businessId: string;
  professionalId: string;
  serviceId: string;
  clientId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  notes: string | null;
  /** Precio y costo del servicio al momento de reservar (null en turnos anteriores a la contabilidad). */
  price: number | null;
  cost: number | null;
  reminderSent: boolean;
  createdAt: Date;
}

export function mapAppointmentDoc(snap: FirebaseFirestore.DocumentSnapshot): AppointmentDoc {
  const data = snap.data()!;
  return {
    id: snap.id,
    businessId: data.businessId,
    professionalId: data.professionalId,
    serviceId: data.serviceId,
    clientId: data.clientId,
    startsAt: data.startsAt.toDate(),
    endsAt: data.endsAt.toDate(),
    status: data.status,
    notes: data.notes ?? null,
    price: data.price ?? null,
    cost: data.cost ?? null,
    reminderSent: data.reminderSent,
    createdAt: data.createdAt.toDate(),
  };
}

export async function getAppointmentsInRange(
  businessId: string,
  start: Date,
  end: Date
): Promise<AppointmentDoc[]> {
  const snap = await getAdminDb()
    .collection(COLLECTIONS.appointments)
    .where("businessId", "==", businessId)
    .where("startsAt", ">=", start)
    .where("startsAt", "<=", end)
    .get();
  const appointments = snap.docs.map(mapAppointmentDoc);
  appointments.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return appointments;
}

export async function getAppointmentsForClient(clientId: string): Promise<AppointmentDoc[]> {
  const snap = await getAdminDb()
    .collection(COLLECTIONS.appointments)
    .where("clientId", "==", clientId)
    .get();
  const appointments = snap.docs.map(mapAppointmentDoc);
  appointments.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  return appointments;
}

export async function getAppointmentById(id: string): Promise<AppointmentDoc | null> {
  const snap = await getAdminDb().collection(COLLECTIONS.appointments).doc(id).get();
  return snap.exists ? mapAppointmentDoc(snap) : null;
}

// Un solo filtro de rango (sin igualdad combinada) para no necesitar índice compuesto.
export async function getDueReminders(windowStart: Date, windowEnd: Date): Promise<AppointmentDoc[]> {
  const snap = await getAdminDb()
    .collection(COLLECTIONS.appointments)
    .where("startsAt", ">=", windowStart)
    .where("startsAt", "<=", windowEnd)
    .get();
  return snap.docs
    .map(mapAppointmentDoc)
    .filter((a) => !a.reminderSent && (a.status === "CONFIRMADO" || a.status === "PENDIENTE"));
}

export async function markReminderSent(id: string): Promise<void> {
  await getAdminDb().collection(COLLECTIONS.appointments).doc(id).update({ reminderSent: true });
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<void> {
  await getAdminDb().collection(COLLECTIONS.appointments).doc(id).update({ status });
}

/** Escritura directa, sin re-chequeo de disponibilidad. Sólo para el seed script. */
export async function createAppointmentDoc(data: {
  businessId: string;
  professionalId: string;
  serviceId: string;
  clientId: string;
  startsAt: Date;
  endsAt: Date;
  status?: AppointmentStatus;
  notes?: string;
  price?: number;
  cost?: number;
}): Promise<AppointmentDoc> {
  const ref = getAdminDb().collection(COLLECTIONS.appointments).doc();
  const doc = {
    businessId: data.businessId,
    professionalId: data.professionalId,
    serviceId: data.serviceId,
    clientId: data.clientId,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    status: data.status ?? ("CONFIRMADO" as AppointmentStatus),
    notes: data.notes ?? null,
    price: data.price ?? null,
    cost: data.cost ?? null,
    reminderSent: false,
    createdAt: new Date(),
  };
  await ref.set(doc);
  return { id: ref.id, ...doc };
}

export class SlotUnavailableError extends Error {}

/**
 * Crea el turno dentro de una transacción: vuelve a chequear disponibilidad
 * contra los turnos que pisan el horario del profesional elegido ese día, y
 * sólo escribe si el slot sigue libre. Usada por la reserva real (bookings.ts).
 */
export async function createAppointmentTx(input: {
  businessId: string;
  professionalId: string;
  serviceId: string;
  clientId: string;
  startsAt: Date;
  endsAt: Date;
  durationMin: number;
  businessHours: BusinessHourLike[];
  notes?: string;
  price: number;
  cost: number;
}): Promise<AppointmentDoc> {
  const db = getAdminDb();
  const dayStart = new Date(input.startsAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(input.startsAt);
  dayEnd.setHours(23, 59, 59, 999);

  const newRef = db.collection(COLLECTIONS.appointments).doc();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(
      db
        .collection(COLLECTIONS.appointments)
        .where("businessId", "==", input.businessId)
        .where("startsAt", ">=", dayStart)
        .where("startsAt", "<=", dayEnd)
    );

    const busy = snap.docs
      .map(mapAppointmentDoc)
      .filter(
        (a) =>
          a.professionalId === input.professionalId &&
          (a.status === "PENDIENTE" || a.status === "CONFIRMADO")
      );

    const slots = generateAvailableSlots({
      date: dayStart,
      durationMin: input.durationMin,
      businessHours: input.businessHours,
      busyRanges: busy,
    });

    if (!slots.some((s) => s.getTime() === input.startsAt.getTime())) {
      throw new SlotUnavailableError("Ese horario ya no está disponible.");
    }

    const doc = {
      businessId: input.businessId,
      professionalId: input.professionalId,
      serviceId: input.serviceId,
      clientId: input.clientId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: "CONFIRMADO" as AppointmentStatus,
      notes: input.notes ?? null,
      price: input.price,
      cost: input.cost,
      reminderSent: false,
      createdAt: new Date(),
    };
    tx.create(newRef, doc);
    return { id: newRef.id, ...doc };
  });
}

/**
 * Vuelve a confirmar un turno cancelado, chequeando dentro de una transacción
 * que el profesional no tenga otro turno activo que se superponga (alguien
 * pudo haber reservado ese horario después de la cancelación).
 */
export async function reactivateAppointmentTx(id: string): Promise<void> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.appointments).doc(id);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new SlotUnavailableError("No encontramos ese turno.");
    const appointment = mapAppointmentDoc(snap);

    const dayStart = new Date(appointment.startsAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(appointment.startsAt);
    dayEnd.setHours(23, 59, 59, 999);

    const daySnap = await tx.get(
      db
        .collection(COLLECTIONS.appointments)
        .where("businessId", "==", appointment.businessId)
        .where("startsAt", ">=", dayStart)
        .where("startsAt", "<=", dayEnd)
    );

    const clash = daySnap.docs
      .map(mapAppointmentDoc)
      .some(
        (a) =>
          a.id !== appointment.id &&
          a.professionalId === appointment.professionalId &&
          (a.status === "PENDIENTE" || a.status === "CONFIRMADO") &&
          a.startsAt < appointment.endsAt &&
          appointment.startsAt < a.endsAt
      );

    if (clash) {
      throw new SlotUnavailableError("Ese horario ya está ocupado por otro turno, no se puede reactivar.");
    }

    tx.update(ref, { status: "CONFIRMADO" });
  });
}

export interface ClientAppointmentView extends AppointmentDoc {
  business: BusinessDoc;
  service: ServiceDoc;
  professional: ProfessionalDoc;
}

/** Hidrata turnos con negocio + servicio + profesional (usado en /mis-turnos). */
export async function hydrateForClient(appointments: AppointmentDoc[]): Promise<ClientAppointmentView[]> {
  if (appointments.length === 0) return [];
  const db = getAdminDb();
  const businessIds = [...new Set(appointments.map((a) => a.businessId))];
  const serviceIds = [...new Set(appointments.map((a) => a.serviceId))];
  const professionalIds = [...new Set(appointments.map((a) => a.professionalId))];

  const [businessSnaps, serviceSnaps, professionalSnaps] = await Promise.all([
    db.getAll(...businessIds.map((id) => db.collection(COLLECTIONS.businesses).doc(id))),
    db.getAll(...serviceIds.map((id) => db.collection(COLLECTIONS.services).doc(id))),
    db.getAll(...professionalIds.map((id) => db.collection(COLLECTIONS.professionals).doc(id))),
  ]);

  const businesses = new Map(businessSnaps.filter((s) => s.exists).map((s) => [s.id, mapBusinessDoc(s)]));
  const services = new Map(serviceSnaps.filter((s) => s.exists).map((s) => [s.id, mapServiceDoc(s)]));
  const professionals = new Map(
    professionalSnaps.filter((s) => s.exists).map((s) => [s.id, mapProfessionalDoc(s)])
  );

  const out: ClientAppointmentView[] = [];
  for (const a of appointments) {
    const business = businesses.get(a.businessId);
    const service = services.get(a.serviceId);
    const professional = professionals.get(a.professionalId);
    if (!business || !service || !professional) continue;
    out.push({ ...a, business, service, professional });
  }
  return out;
}

export interface BusinessAppointmentView extends AppointmentDoc {
  service: ServiceDoc;
  professional: ProfessionalDoc;
  client: UserDoc;
}

/** Hidrata turnos con servicio + profesional + cliente (usado en /panel/agenda y /panel). */
export async function hydrateForBusiness(appointments: AppointmentDoc[]): Promise<BusinessAppointmentView[]> {
  if (appointments.length === 0) return [];
  const db = getAdminDb();
  const serviceIds = [...new Set(appointments.map((a) => a.serviceId))];
  const professionalIds = [...new Set(appointments.map((a) => a.professionalId))];
  const clientIds = [...new Set(appointments.map((a) => a.clientId))];

  const [serviceSnaps, professionalSnaps, clientSnaps] = await Promise.all([
    db.getAll(...serviceIds.map((id) => db.collection(COLLECTIONS.services).doc(id))),
    db.getAll(...professionalIds.map((id) => db.collection(COLLECTIONS.professionals).doc(id))),
    db.getAll(...clientIds.map((id) => db.collection(COLLECTIONS.users).doc(id))),
  ]);

  const services = new Map(serviceSnaps.filter((s) => s.exists).map((s) => [s.id, mapServiceDoc(s)]));
  const professionals = new Map(
    professionalSnaps.filter((s) => s.exists).map((s) => [s.id, mapProfessionalDoc(s)])
  );
  const clients = new Map(clientSnaps.filter((s) => s.exists).map((s) => [s.id, mapUserDoc(s)]));

  const out: BusinessAppointmentView[] = [];
  for (const a of appointments) {
    const service = services.get(a.serviceId);
    const professional = professionals.get(a.professionalId);
    const client = clients.get(a.clientId);
    if (!service || !professional || !client) continue;
    out.push({ ...a, service, professional, client });
  }
  return out;
}

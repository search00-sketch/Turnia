// Corrección de datos guardados con la zona horaria equivocada.
//
// Hasta que se fijó la zona horaria del servidor (src/lib/timezone.ts), en
// Vercel (que corre en UTC) un turno reservado "a las 10:00" se guardaba como
// 10:00 UTC, o sea 07:00 en Argentina. Ahora el servidor interpreta todo en
// hora argentina, así que esos turnos viejos se ven 3 horas antes. Lo mismo
// pasa con la fecha "pagado hasta" que carga el admin.
//
// Los turnos creados desde una computadora en hora argentina (por ejemplo, con
// `npm run db:seed` local) ya están bien. Como no queda registro de dónde se
// creó cada turno, se clasifican según el horario de atención del negocio:
//   - CORREGIR: en hora argentina cae fuera del horario, y corrido cae dentro.
//   - AMBIGUO: cae dentro del horario de las dos formas.
//   - OK: sólo tiene sentido como está.
//   - SIN DATOS: no encaja de ninguna forma (por ejemplo, cambió el horario).
//
// Se ignoran los turnos con precio guardado (los crea el código nuevo, que
// salió en el mismo deploy que el arreglo de zona horaria) y los ya corregidos
// (tzFixed), así que aplicar la corrección dos veces no corre nada dos veces.
import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { mapHourDoc, type BusinessHourDoc } from "@/lib/db/hours";
import type { AppointmentStatus } from "@/lib/db/appointments";

export type TzFixLabel = "CORREGIR" | "AMBIGUO" | "OK" | "SIN DATOS";

export interface TzFixAppointmentRow {
  id: string;
  businessName: string;
  status: AppointmentStatus;
  label: TzFixLabel;
  currentStart: Date;
  fixedStart: Date;
  fixedEnd: Date;
}

export interface TzFixPaidUntilRow {
  businessId: string;
  businessName: string;
  current: Date;
  fixed: Date;
}

export interface TzFixAnalysis {
  appointments: TzFixAppointmentRow[];
  paidUntil: TzFixPaidUntilRow[];
  /** Turnos creados con el código nuevo: ya están bien. */
  newCount: number;
  alreadyFixedCount: number;
}

/** El instante que corresponde a leer la hora UTC guardada como si fuera hora local. */
export function utcWallClockAsLocal(d: Date): Date {
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds()
  );
}

function minutesOfDay(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fitsBusinessHours(start: Date, end: Date, hours: BusinessHourDoc[]): boolean {
  const day = hours.find((h) => h.dayOfWeek === start.getDay());
  if (!day || day.isClosed || !day.openTime || !day.closeTime) return false;
  if (start.toDateString() !== new Date(end.getTime() - 1).toDateString()) return false;
  const endMinutes = minutesOfDay(end) === 0 ? 24 * 60 : minutesOfDay(end);
  return minutesOfDay(start) >= toMinutes(day.openTime) && endMinutes <= toMinutes(day.closeTime);
}

export function classifyAppointment(startsAt: Date, endsAt: Date, hours: BusinessHourDoc[]): TzFixLabel {
  const fitsNow = fitsBusinessHours(startsAt, endsAt, hours);
  const fitsFixed = fitsBusinessHours(utcWallClockAsLocal(startsAt), utcWallClockAsLocal(endsAt), hours);
  if (!fitsNow && fitsFixed) return "CORREGIR";
  if (fitsNow && fitsFixed) return "AMBIGUO";
  if (fitsNow) return "OK";
  return "SIN DATOS";
}

export async function analyzeTimezoneFix(): Promise<TzFixAnalysis> {
  const db = getAdminDb();
  const [hoursSnap, businessesSnap, appointmentsSnap] = await Promise.all([
    db.collection(COLLECTIONS.businessHours).get(),
    db.collection(COLLECTIONS.businesses).get(),
    db.collection(COLLECTIONS.appointments).get(),
  ]);

  const hoursByBusiness = new Map<string, BusinessHourDoc[]>();
  for (const doc of hoursSnap.docs) {
    const h = mapHourDoc(doc);
    hoursByBusiness.set(h.businessId, [...(hoursByBusiness.get(h.businessId) ?? []), h]);
  }
  const businessNames = new Map(businessesSnap.docs.map((d) => [d.id, d.data().name as string]));

  const appointments: TzFixAppointmentRow[] = [];
  let newCount = 0;
  let alreadyFixedCount = 0;

  for (const doc of appointmentsSnap.docs) {
    const data = doc.data();
    if (data.tzFixed) {
      alreadyFixedCount++;
      continue;
    }
    if (data.price !== undefined && data.price !== null) {
      newCount++;
      continue;
    }
    const startsAt: Date = data.startsAt.toDate();
    const endsAt: Date = data.endsAt.toDate();
    appointments.push({
      id: doc.id,
      businessName: businessNames.get(data.businessId) ?? "Negocio eliminado",
      status: data.status,
      label: classifyAppointment(startsAt, endsAt, hoursByBusiness.get(data.businessId) ?? []),
      currentStart: startsAt,
      fixedStart: utcWallClockAsLocal(startsAt),
      fixedEnd: utcWallClockAsLocal(endsAt),
    });
  }
  appointments.sort((a, b) => a.currentStart.getTime() - b.currentStart.getTime());

  // "Pagado hasta": el admin siempre lo carga como medianoche. Si en hora local
  // no es medianoche pero en UTC sí, se guardó en el servidor UTC.
  const paidUntil: TzFixPaidUntilRow[] = [];
  for (const doc of businessesSnap.docs) {
    const data = doc.data();
    const current: Date | undefined = data.paidUntil?.toDate();
    if (!current || data.paidUntilTzFixed) continue;
    const isLocalMidnight = current.getHours() === 0 && current.getMinutes() === 0;
    const isUtcMidnight = current.getUTCHours() === 0 && current.getUTCMinutes() === 0;
    if (!isLocalMidnight && isUtcMidnight) {
      paidUntil.push({ businessId: doc.id, businessName: data.name, current, fixed: utcWallClockAsLocal(current) });
    }
  }

  return { appointments, paidUntil, newCount, alreadyFixedCount };
}

/**
 * Corrige los turnos elegidos (sólo si siguen pendientes de corrección según
 * un análisis hecho en el momento) y todas las fechas "pagado hasta".
 */
export async function applyTimezoneFix(appointmentIds: string[]): Promise<{ appointments: number; paidUntil: number }> {
  const db = getAdminDb();
  const analysis = await analyzeTimezoneFix();
  const chosen = new Set(appointmentIds);

  let writes: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }[] = [];
  let appointments = 0;
  for (const row of analysis.appointments) {
    if (!chosen.has(row.id)) continue;
    writes.push({
      ref: db.collection(COLLECTIONS.appointments).doc(row.id),
      data: { startsAt: row.fixedStart, endsAt: row.fixedEnd, tzFixed: true },
    });
    appointments++;
  }
  for (const row of analysis.paidUntil) {
    writes.push({
      ref: db.collection(COLLECTIONS.businesses).doc(row.businessId),
      data: { paidUntil: row.fixed, paidUntilTzFixed: true },
    });
  }

  while (writes.length > 0) {
    const batch = db.batch();
    for (const w of writes.slice(0, 400)) batch.update(w.ref, w.data);
    await batch.commit();
    writes = writes.slice(400);
  }

  return { appointments, paidUntil: analysis.paidUntil.length };
}

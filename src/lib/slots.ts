import { addMinutes, isBefore } from "date-fns";
import { MIN_BOOKING_NOTICE_MINUTES, SLOT_STEP_MINUTES } from "@/lib/config";

export interface BusinessHourLike {
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

export interface BusyRange {
  startsAt: Date;
  endsAt: Date;
}

function parseTimeOnDate(date: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Calcula los horarios de inicio disponibles para un día puntual,
 * en base al horario de atención del negocio, la duración del servicio
 * y los turnos que ya ocupan la agenda (del profesional o del negocio).
 */
export function generateAvailableSlots({
  date,
  durationMin,
  businessHours,
  busyRanges,
  stepMinutes = SLOT_STEP_MINUTES,
  now = new Date(),
  minNoticeMinutes = MIN_BOOKING_NOTICE_MINUTES,
}: {
  date: Date;
  durationMin: number;
  businessHours: BusinessHourLike[];
  busyRanges: BusyRange[];
  stepMinutes?: number;
  now?: Date;
  minNoticeMinutes?: number;
}): Date[] {
  const dayOfWeek = date.getDay();
  const hours = businessHours.find((h) => h.dayOfWeek === dayOfWeek);

  if (!hours || hours.isClosed || !hours.openTime || !hours.closeTime) {
    return [];
  }

  const open = parseTimeOnDate(date, hours.openTime);
  const close = parseTimeOnDate(date, hours.closeTime);
  const earliestBookable = addMinutes(now, minNoticeMinutes);

  const slots: Date[] = [];
  let cursor = open;

  while (true) {
    const slotEnd = addMinutes(cursor, durationMin);
    if (slotEnd > close) break;

    const isPast = isBefore(cursor, earliestBookable);
    const overlaps = busyRanges.some(
      (busy) => cursor < busy.endsAt && slotEnd > busy.startsAt
    );

    if (!isPast && !overlaps) {
      slots.push(new Date(cursor));
    }

    cursor = addMinutes(cursor, stepMinutes);
  }

  return slots;
}

/** Arma un rango de fechas [hoy, hoy + days) usable para el selector de fecha del wizard. */
export function nextDaysFrom(start: Date, days: number): Date[] {
  const out: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    out.push(d);
  }
  return out;
}

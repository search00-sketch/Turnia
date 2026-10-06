import { getHoursByBusiness } from "@/lib/db/hours";
import { getProfessionalsByBusiness } from "@/lib/db/professionals";
import { getAppointmentsInRange } from "@/lib/db/appointments";
import { generateAvailableSlots } from "@/lib/slots";

export interface ShareDay {
  dateISO: string; // "yyyy-MM-dd"
  weekday: number; // 0 = domingo
  /** Horarios en los que al menos un profesional está libre. */
  free: string[];
  /** Horarios del día que ya están tomados (para mostrarlos tachados). */
  taken: string[];
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Cuántos días de calendario se miran como máximo para juntar los días abiertos pedidos. */
const MAX_LOOKAHEAD_DAYS = 21;

/**
 * Turnos libres y tomados de los próximos `days` días abiertos, para armar la
 * imagen de "Turnos disponibles". Un horario está libre si algún profesional
 * activo lo tiene libre para un servicio de `durationMin`; "tomado" es un
 * horario del horario de atención que ya no tiene a nadie libre.
 */
export async function getShareAvailability(
  businessId: string,
  { durationMin, stepMinutes, days }: { durationMin: number; stepMinutes: number; days: number }
): Promise<ShareDay[]> {
  const [businessHours, professionals] = await Promise.all([
    getHoursByBusiness(businessId),
    getProfessionalsByBusiness(businessId, { activeOnly: true }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const until = new Date(today);
  until.setDate(until.getDate() + MAX_LOOKAHEAD_DAYS);
  const appointments = (await getAppointmentsInRange(businessId, today, until)).filter(
    (a) => a.status === "PENDIENTE" || a.status === "CONFIRMADO"
  );

  const out: ShareDay[] = [];
  for (let i = 0; i < MAX_LOOKAHEAD_DAYS && out.length < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);

    const all = generateAvailableSlots({ date, durationMin, businessHours, busyRanges: [], stepMinutes });
    if (all.length === 0) continue; // cerrado o ya no quedan horarios hoy

    const free = new Set<string>();
    for (const prof of professionals) {
      const busy = appointments.filter((a) => a.professionalId === prof.id);
      for (const s of generateAvailableSlots({ date, durationMin, businessHours, busyRanges: busy, stepMinutes })) {
        free.add(hhmm(s));
      }
    }

    const times = all.map(hhmm);
    out.push({
      dateISO: iso(date),
      weekday: date.getDay(),
      free: times.filter((t) => free.has(t)),
      taken: times.filter((t) => !free.has(t)),
    });
  }
  return out;
}

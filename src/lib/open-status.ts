import type { BusinessHourLike } from "@/lib/slots";

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function minutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** "20 h" o "20:30 h" */
function hourLabel(hhmm: string) {
  const [h, m] = hhmm.split(":");
  return m === "00" ? `${Number(h)} h` : `${Number(h)}:${m} h`;
}

export interface OpenStatus {
  open: boolean;
  label: string;
}

/**
 * "Abierto · cierra 20 h", "Abre hoy 10 h", "Abre mañana 9 h", "Abre el lunes 10 h".
 * Usa la hora local del servidor, que ya está fijada en hora argentina.
 */
export function getOpenStatus(hours: BusinessHourLike[], now = new Date()): OpenStatus | null {
  const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));
  const today = byDay.get(now.getDay());
  const nowMin = now.getHours() * 60 + now.getMinutes();

  if (today && !today.isClosed && today.openTime && today.closeTime) {
    if (nowMin >= minutes(today.openTime) && nowMin < minutes(today.closeTime)) {
      return { open: true, label: `Abierto · cierra ${hourLabel(today.closeTime)}` };
    }
    if (nowMin < minutes(today.openTime)) {
      return { open: false, label: `Abre hoy ${hourLabel(today.openTime)}` };
    }
  }

  for (let i = 1; i <= 7; i++) {
    const day = (now.getDay() + i) % 7;
    const h = byDay.get(day);
    if (h && !h.isClosed && h.openTime && h.closeTime) {
      const when = i === 1 ? "mañana" : `el ${WEEKDAYS[day]}`;
      return { open: false, label: `Abre ${when} ${hourLabel(h.openTime)}` };
    }
  }
  return null;
}

import { format } from "date-fns";
import { es } from "date-fns/locale";

export function formatDateLong(date: Date): string {
  // ej: "martes, 12 de agosto"
  return format(date, "EEEE d 'de' MMMM", { locale: es });
}

export function formatDateShort(date: Date): string {
  // ej: "12/08"
  return format(date, "dd/MM");
}

export function formatDayNumber(date: Date): string {
  return format(date, "d");
}

export function formatWeekday(date: Date): string {
  return format(date, "EEE", { locale: es });
}

export function formatTime(date: Date): string {
  return format(date, "HH:mm");
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

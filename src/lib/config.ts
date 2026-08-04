export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Turnia";

// Categorías de negocio disponibles en la plataforma.
export const CATEGORIES = [
  { slug: "peluqueria", label: "Peluquería" },
  { slug: "barberia", label: "Barbería" },
  { slug: "unas", label: "Uñas" },
  { slug: "estetica", label: "Estética" },
  { slug: "depilacion", label: "Depilación" },
  { slug: "spa", label: "Spa y masajes" },
  { slug: "otros", label: "Otros" },
] as const;

export const DAYS_OF_WEEK = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

// Duración de cada "casillero" horario que se le ofrece al cliente al reservar.
export const SLOT_STEP_MINUTES = 30;

// Con cuánta anticipación mínima se puede reservar (en minutos).
export const MIN_BOOKING_NOTICE_MINUTES = 60;

// Con cuántas horas de anticipación se envía el recordatorio automático.
export const REMINDER_HOURS_BEFORE = 24;

export function categoryLabel(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}

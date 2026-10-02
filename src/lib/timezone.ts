// Toda la lógica de fechas del servidor (horarios de atención, slots, "hoy",
// meses de la contabilidad, emails) trabaja con hora local: setHours,
// getDay, new Date("yyyy-MM-ddT10:00:00"), format de date-fns, etc. En Vercel
// el servidor corre en UTC, así que sin esto un turno de las 10:00 quedaba
// guardado como 10:00 UTC (07:00 en Argentina) y "hoy" cambiaba a las 21hs.
//
// Vercel no deja configurar la variable TZ desde el panel, pero Node sí
// respeta un cambio de process.env.TZ en tiempo de ejecución. Este módulo lo
// fija apenas se carga: lo importan instrumentation.ts (al arrancar el
// servidor) y firebase-admin.ts (que usa todo acceso a datos), así que corre
// antes de cualquier cálculo de fechas del servidor y de los scripts.
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Argentina/Buenos_Aires";

if (typeof process !== "undefined" && process.env && process.env.TZ !== APP_TIMEZONE) {
  process.env.TZ = APP_TIMEZONE;
}

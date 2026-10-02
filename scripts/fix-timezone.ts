// Corrige datos guardados con la zona horaria equivocada.
//
// Hasta que se fijó la zona horaria del servidor (src/lib/timezone.ts), en
// Vercel (que corre en UTC) un turno reservado "a las 10:00" se guardaba como
// 10:00 UTC, o sea 07:00 en Argentina. Ahora el servidor interpreta todo en
// hora argentina, así que esos turnos viejos se verían 3 horas antes. Lo
// mismo pasa con la fecha "pagado hasta" que carga el admin.
//
// Los turnos creados desde una computadora en hora argentina (por ejemplo,
// `npm run db:seed` corrido localmente) ya están bien y NO hay que tocarlos.
// Como en la base no queda registro de dónde se creó cada turno, el script
// clasifica cada uno según el horario de atención del negocio:
//   - CORREGIR: en hora argentina cae fuera del horario de atención, y
//     corrido +3h cae dentro → seguro se creó en el servidor.
//   - AMBIGUO: cae dentro del horario de las dos formas.
//   - OK: sólo tiene sentido como está.
//
// Uso:
//   npm run fix:timezone                         # sólo muestra qué haría (no escribe nada)
//   npm run fix:timezone -- --apply              # corrige los CORREGIR (y las fechas "pagado hasta")
//   npm run fix:timezone -- --apply --incluir-ambiguos   # también los AMBIGUO
//   npm run fix:timezone -- --apply --ids=ID1,ID2        # además, fuerza turnos puntuales
//
// Sólo mira turnos creados antes de --hasta=yyyy-MM-dd (por defecto, ahora):
// conviene correrlo apenas se despliega el arreglo. Cada documento corregido
// queda marcado con tzFixed: true, así correrlo dos veces no lo corre dos veces.
import "dotenv/config";
import { getAdminDb } from "../src/lib/firebase-admin";
import { APP_TIMEZONE } from "../src/lib/timezone";
import { COLLECTIONS } from "../src/lib/db/collections";
import { mapHourDoc, type BusinessHourDoc } from "../src/lib/db/hours";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const INCLUDE_AMBIGUOUS = args.includes("--incluir-ambiguos");
const FORCED_IDS = new Set(
  (args.find((a) => a.startsWith("--ids="))?.slice("--ids=".length) ?? "").split(",").filter(Boolean)
);
const untilArg = args.find((a) => a.startsWith("--hasta="))?.slice("--hasta=".length);
const UNTIL = untilArg ? new Date(`${untilArg}T23:59:59`) : new Date();

/** El instante que corresponde a leer la hora UTC guardada como si fuera hora local. */
function utcWallClockAsLocal(d: Date): Date {
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

function fitsBusinessHours(start: Date, end: Date, hours: BusinessHourDoc[]): boolean {
  const day = hours.find((h) => h.dayOfWeek === start.getDay());
  if (!day || day.isClosed || !day.openTime || !day.closeTime) return false;
  if (start.toDateString() !== new Date(end.getTime() - 1).toDateString()) return false;
  const endMinutes = minutesOfDay(end) === 0 ? 24 * 60 : minutesOfDay(end);
  return minutesOfDay(start) >= toMinutes(day.openTime) && endMinutes <= toMinutes(day.closeTime);
}

function fmt(d: Date) {
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

async function main() {
  const db = getAdminDb();
  console.log(`Zona horaria de la app: ${APP_TIMEZONE} (TZ del proceso: ${process.env.TZ})`);
  console.log(APPLY ? "Modo: APLICAR cambios" : "Modo: simulación (no se escribe nada; usá --apply para aplicar)");
  console.log(`Turnos creados hasta: ${fmt(UNTIL)}\n`);

  const hoursByBusiness = new Map<string, BusinessHourDoc[]>();
  for (const doc of (await db.collection(COLLECTIONS.businessHours).get()).docs) {
    const h = mapHourDoc(doc);
    hoursByBusiness.set(h.businessId, [...(hoursByBusiness.get(h.businessId) ?? []), h]);
  }

  const appointments = await db.collection(COLLECTIONS.appointments).where("createdAt", "<=", UNTIL).get();
  const counts = { CORREGIR: 0, AMBIGUO: 0, OK: 0, "SIN DATOS": 0, "YA CORREGIDO": 0 };
  let writes: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }[] = [];

  for (const doc of appointments.docs) {
    const data = doc.data();
    const startsAt: Date = data.startsAt.toDate();
    const endsAt: Date = data.endsAt.toDate();
    const fixedStart = utcWallClockAsLocal(startsAt);
    const fixedEnd = utcWallClockAsLocal(endsAt);

    let label: keyof typeof counts;
    if (data.tzFixed) {
      label = "YA CORREGIDO";
    } else {
      const hours = hoursByBusiness.get(data.businessId) ?? [];
      const fitsNow = fitsBusinessHours(startsAt, endsAt, hours);
      const fitsFixed = fitsBusinessHours(fixedStart, fixedEnd, hours);
      if (!fitsNow && fitsFixed) label = "CORREGIR";
      else if (fitsNow && fitsFixed) label = "AMBIGUO";
      else if (fitsNow) label = "OK";
      else label = "SIN DATOS";
    }
    counts[label]++;

    const shouldFix =
      label !== "YA CORREGIDO" &&
      (FORCED_IDS.has(doc.id) || label === "CORREGIR" || (label === "AMBIGUO" && INCLUDE_AMBIGUOUS));

    console.log(
      `${shouldFix ? "→" : " "} [${label}] turno ${doc.id} (${data.status}): ${fmt(startsAt)}` +
        (label === "YA CORREGIDO" ? "" : ` | corregido sería ${fmt(fixedStart)}`)
    );

    if (shouldFix) writes.push({ ref: doc.ref, data: { startsAt: fixedStart, endsAt: fixedEnd, tzFixed: true } });
  }

  // "Pagado hasta": el admin siempre lo carga como medianoche. Si en hora
  // local no es medianoche pero en UTC sí, se guardó en el servidor UTC.
  const businesses = await db.collection(COLLECTIONS.businesses).get();
  let paidUntilFixes = 0;
  for (const doc of businesses.docs) {
    const paidUntil: Date | undefined = doc.data().paidUntil?.toDate();
    if (!paidUntil || doc.data().paidUntilTzFixed) continue;
    const isLocalMidnight = paidUntil.getHours() === 0 && paidUntil.getMinutes() === 0;
    const isUtcMidnight = paidUntil.getUTCHours() === 0 && paidUntil.getUTCMinutes() === 0;
    if (!isLocalMidnight && isUtcMidnight) {
      const fixed = utcWallClockAsLocal(paidUntil);
      console.log(`→ [CORREGIR] "pagado hasta" del negocio ${doc.id}: ${fmt(paidUntil)} | corregido ${fmt(fixed)}`);
      writes.push({ ref: doc.ref, data: { paidUntil: fixed, paidUntilTzFixed: true } });
      paidUntilFixes++;
    }
  }

  console.log("\nResumen de turnos:", counts);
  console.log(`Fechas "pagado hasta" a corregir: ${paidUntilFixes}`);
  if (counts.AMBIGUO > 0 && !INCLUDE_AMBIGUOUS) {
    console.log(
      "Hay turnos AMBIGUOS: si se reservaron desde la app desplegada en Vercel, corregilos con --incluir-ambiguos " +
        "(o de a uno con --ids=...). Si se crearon con el seed desde tu computadora, dejalos como están."
    );
  }

  if (!APPLY) {
    console.log(`\nSimulación: se corregirían ${writes.length} documentos. Volvé a correr con --apply para aplicarlo.`);
    return;
  }

  while (writes.length > 0) {
    const batch = db.batch();
    for (const w of writes.slice(0, 400)) batch.update(w.ref, w.data);
    await batch.commit();
    writes = writes.slice(400);
  }
  console.log("\nListo: cambios aplicados.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

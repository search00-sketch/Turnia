// Versión de consola de la corrección de zona horaria (la misma lógica que
// la página /admin/zona-horaria, ver src/lib/db/timezoneFix.ts).
//
// Uso:
//   npm run fix:timezone                                  # sólo muestra qué haría
//   npm run fix:timezone -- --apply                       # corrige los "CORREGIR" y las fechas "pagado hasta"
//   npm run fix:timezone -- --apply --incluir-ambiguos    # también los "AMBIGUO"
//   npm run fix:timezone -- --apply --ids=ID1,ID2         # además, turnos puntuales
import "dotenv/config";
import { APP_TIMEZONE } from "../src/lib/timezone";
import { analyzeTimezoneFix, applyTimezoneFix } from "../src/lib/db/timezoneFix";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const INCLUDE_AMBIGUOUS = args.includes("--incluir-ambiguos");
const FORCED_IDS = new Set(
  (args.find((a) => a.startsWith("--ids="))?.slice("--ids=".length) ?? "").split(",").filter(Boolean)
);

function fmt(d: Date) {
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

async function main() {
  console.log(`Zona horaria de la app: ${APP_TIMEZONE} (TZ del proceso: ${process.env.TZ})`);
  console.log(APPLY ? "Modo: APLICAR cambios\n" : "Modo: simulación (no se escribe nada; usá --apply para aplicar)\n");

  const analysis = await analyzeTimezoneFix();
  const chosen = analysis.appointments
    .filter((a) => FORCED_IDS.has(a.id) || a.label === "CORREGIR" || (a.label === "AMBIGUO" && INCLUDE_AMBIGUOUS))
    .map((a) => a.id);

  for (const a of analysis.appointments) {
    console.log(
      `${chosen.includes(a.id) ? "→" : " "} [${a.label}] turno ${a.id} (${a.businessName}, ${a.status}): ` +
        `${fmt(a.currentStart)} | corregido sería ${fmt(a.fixedStart)}`
    );
  }
  for (const p of analysis.paidUntil) {
    console.log(`→ [CORREGIR] "pagado hasta" de ${p.businessName}: ${fmt(p.current)} | corregido ${fmt(p.fixed)}`);
  }
  console.log(
    `\nYa correctos: ${analysis.newCount} turnos creados después del arreglo, ${analysis.alreadyFixedCount} ya corregidos.`
  );

  if (!APPLY) {
    console.log(`Simulación: se corregirían ${chosen.length} turnos y ${analysis.paidUntil.length} fechas. Usá --apply para aplicarlo.`);
    return;
  }
  const result = await applyTimezoneFix(chosen);
  console.log(`Listo: se corrigieron ${result.appointments} turnos y ${result.paidUntil} fechas "pagado hasta".`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

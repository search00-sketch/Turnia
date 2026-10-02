import { analyzeTimezoneFix } from "@/lib/db/timezoneFix";
import { APP_TIMEZONE } from "@/lib/timezone";
import TimezoneFixForm from "@/components/timezone-fix-form";

export const dynamic = "force-dynamic";

function fmt(d: Date) {
  return d.toLocaleString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function ZonaHorariaPage() {
  const analysis = await analyzeTimezoneFix();
  const okCount = analysis.appointments.filter((a) => a.label === "OK").length;
  const reviewable = analysis.appointments.filter((a) => a.label !== "OK");

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-2 text-sm text-neutral-600">
        <h2 className="font-semibold text-neutral-900 text-base">Corrección de zona horaria</h2>
        <p>
          Antes de fijar la zona horaria ({APP_TIMEZONE}), los turnos reservados en la app publicada se guardaban 3 horas
          antes (un turno de las 10:00 quedaba como 07:00). Acá podés corregirlos.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Corregir</strong>: hoy figuran fuera del horario de atención y corridos 3 horas encajan. Vienen marcados.
          </li>
          <li>
            <strong>Ambiguo</strong>: encajan en el horario de las dos formas. Marcalos si los reservó un cliente desde la app
            publicada; dejalos sin marcar si los creaste con datos de ejemplo desde tu computadora.
          </li>
          <li>
            <strong>Sin datos</strong>: no encajan de ninguna forma (por ejemplo, cambió el horario del negocio). Revisalos a mano.
          </li>
        </ul>
        <p className="text-neutral-400">
          Ya correctos: {okCount} turnos sin cambios necesarios, {analysis.newCount} turnos creados después del arreglo,{" "}
          {analysis.alreadyFixedCount} ya corregidos.
        </p>
      </div>

      <TimezoneFixForm
        appointments={reviewable.map((a) => ({
          id: a.id,
          businessName: a.businessName,
          status: a.status,
          label: a.label,
          current: fmt(a.currentStart),
          fixed: fmt(a.fixedStart),
        }))}
        paidUntil={analysis.paidUntil.map((p) => ({
          businessId: p.businessId,
          businessName: p.businessName,
          current: fmtDate(p.current),
          fixed: fmtDate(p.fixed),
        }))}
      />
    </div>
  );
}

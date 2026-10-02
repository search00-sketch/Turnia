import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { requireBusinessUser } from "@/lib/session";
import { getAppointmentsInRange } from "@/lib/db/appointments";
import { getServicesByBusiness } from "@/lib/db/services";
import { getMovementsInRange } from "@/lib/db/movements";
import { buildAccountingReport } from "@/lib/accounting";
import { formatPrice } from "@/lib/format";
import MovementsManager from "@/components/movements-manager";

export const dynamic = "force-dynamic";

function monthKeyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isoOf(d: Date) {
  return `${monthKeyOf(d)}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatMargin(margin: number | null) {
  return margin === null ? "—" : `${Math.round(margin * 100)}%`;
}

function profitClass(value: number) {
  if (value > 0) return "text-green-700";
  if (value < 0) return "text-red-600";
  return "text-neutral-600";
}

interface Props {
  searchParams: { mes?: string };
}

export default async function ContabilidadPage({ searchParams }: Props) {
  const user = await requireBusinessUser();
  const businessId = user!.business!.id;

  const now = new Date();
  const monthStart = /^\d{4}-\d{2}$/.test(searchParams.mes ?? "")
    ? new Date(`${searchParams.mes}-01T00:00:00`)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  if (Number.isNaN(monthStart.getTime())) monthStart.setTime(new Date(now.getFullYear(), now.getMonth(), 1).getTime());
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);
  const prevMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
  const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);

  const [appointments, services, movements] = await Promise.all([
    getAppointmentsInRange(businessId, monthStart, monthEnd),
    getServicesByBusiness(businessId),
    getMovementsInRange(businessId, monthStart, monthEnd),
  ]);

  const report = buildAccountingReport({ appointments, services, movements });
  const servicesById = new Map(services.map((s) => [s.id, s]));

  const isCurrentMonth = monthKeyOf(monthStart) === monthKeyOf(now);
  const defaultDate = isCurrentMonth ? isoOf(now) : isoOf(monthStart);

  const cards = [
    { label: "Ingresos", value: formatPrice(report.income), className: "text-neutral-900" },
    { label: "Gastos", value: formatPrice(report.expense), className: "text-neutral-900" },
    { label: "Ganancia neta", value: formatPrice(report.profit), className: profitClass(report.profit) },
    { label: "Margen", value: formatMargin(report.margin), className: profitClass(report.profit) },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/panel/contabilidad?mes=${monthKeyOf(prevMonth)}`} className="btn-ghost border border-neutral-200">
            ←
          </Link>
          <form action="/panel/contabilidad" className="flex items-center gap-2">
            <input type="month" name="mes" defaultValue={monthKeyOf(monthStart)} className="input" />
            <button type="submit" className="btn-secondary">Ir</button>
          </form>
          <Link href={`/panel/contabilidad?mes=${monthKeyOf(nextMonth)}`} className="btn-ghost border border-neutral-200">
            →
          </Link>
        </div>
        {!isCurrentMonth && (
          <Link href="/panel/contabilidad" className="text-sm font-semibold text-brand-600">
            Mes actual
          </Link>
        )}
      </div>

      <h2 className="font-semibold text-neutral-900 capitalize -mb-4">
        {format(monthStart, "MMMM yyyy", { locale: es })}
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <p className={`text-2xl font-bold ${c.className}`}>{c.value}</p>
            <p className="text-sm text-neutral-500">{c.label}</p>
          </div>
        ))}
      </div>

      {report.pendingCount > 0 && (
        <div className="card p-4 bg-amber-50 border-amber-100">
          <p className="text-sm text-amber-800">
            Hay {report.pendingCount} {report.pendingCount === 1 ? "turno" : "turnos"} de este mes sin marcar como
            realizados ({formatPrice(report.pendingIncome)}). Se suman a los ingresos cuando los marcás como
            &quot;realizado&quot; en la{" "}
            <Link href="/panel/agenda" className="font-semibold underline">
              Agenda
            </Link>
            .
          </p>
        </div>
      )}

      <div className="card p-6">
        <h2 className="font-semibold text-neutral-900 mb-1">Resultado por servicio / producto</h2>
        <p className="text-sm text-neutral-500 mb-4">
          Ingresos de turnos realizados y movimientos cargados, menos el costo por turno de cada servicio y los gastos
          cargados.
        </p>
        {report.lines.length === 0 ? (
          <p className="text-sm text-neutral-500">Todavía no hay datos para este mes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500 border-b border-neutral-100">
                  <th className="py-2 pr-4 font-medium">Servicio / concepto</th>
                  <th className="py-2 pr-4 font-medium text-right">Realizados</th>
                  <th className="py-2 pr-4 font-medium text-right">Ingresos</th>
                  <th className="py-2 pr-4 font-medium text-right">Gastos</th>
                  <th className="py-2 pr-4 font-medium text-right">Ganancia</th>
                  <th className="py-2 font-medium text-right">Margen</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.map((line) => (
                  <tr key={line.key} className="border-b border-neutral-50 last:border-0">
                    <td className="py-2 pr-4">
                      <p className="text-neutral-900">{line.name}</p>
                      <p className="text-xs text-neutral-400">
                        {line.kind === "SERVICIO" ? line.category ?? "Servicio" : "Otro concepto"}
                      </p>
                    </td>
                    <td className="py-2 pr-4 text-right text-neutral-600">
                      {line.kind === "SERVICIO" ? line.completedCount : "—"}
                    </td>
                    <td className="py-2 pr-4 text-right text-neutral-600 whitespace-nowrap">{formatPrice(line.income)}</td>
                    <td className="py-2 pr-4 text-right text-neutral-600 whitespace-nowrap">{formatPrice(line.expense)}</td>
                    <td className={`py-2 pr-4 text-right font-semibold whitespace-nowrap ${profitClass(line.profit)}`}>
                      {formatPrice(line.profit)}
                    </td>
                    <td className="py-2 text-right text-neutral-600">{formatMargin(line.margin)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-neutral-200 font-semibold">
                  <td className="py-2 pr-4 text-neutral-900">Total</td>
                  <td className="py-2 pr-4 text-right text-neutral-900">{report.completedCount}</td>
                  <td className="py-2 pr-4 text-right text-neutral-900 whitespace-nowrap">{formatPrice(report.income)}</td>
                  <td className="py-2 pr-4 text-right text-neutral-900 whitespace-nowrap">{formatPrice(report.expense)}</td>
                  <td className={`py-2 pr-4 text-right whitespace-nowrap ${profitClass(report.profit)}`}>
                    {formatPrice(report.profit)}
                  </td>
                  <td className="py-2 text-right text-neutral-900">{formatMargin(report.margin)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {services.some((s) => s.active && s.cost === 0) && (
          <p className="text-xs text-neutral-400 mt-4">
            Algunos servicios no tienen cargado un costo por turno, así que su ganancia puede verse más alta de lo real.
            Podés cargarlo en{" "}
            <Link href="/panel/servicios" className="underline">
              Servicios
            </Link>
            .
          </p>
        )}
      </div>

      <MovementsManager
        defaultDate={defaultDate}
        services={services.map((s) => ({ id: s.id, name: s.name, active: s.active }))}
        movements={movements.map((m) => ({
          id: m.id,
          type: m.type,
          dateISO: isoOf(m.date),
          amount: m.amount,
          concept: m.concept,
          serviceName: m.serviceId ? servicesById.get(m.serviceId)?.name ?? "Servicio eliminado" : null,
          notes: m.notes,
        }))}
      />
    </div>
  );
}

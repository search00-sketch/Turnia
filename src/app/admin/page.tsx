import { getPlatformStats } from "@/lib/db/adminStats";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  CANCELADO: "Cancelado",
  COMPLETADO: "Completado",
};

function formatWeekLabel(isoWeekStart: string) {
  const [year, month, day] = isoWeekStart.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

export default async function AdminPage() {
  const stats = await getPlatformStats();

  const totalAppointments = Object.values(stats.appointmentsByStatus).reduce((a, b) => a + b, 0);

  const cards = [
    { label: "Negocios totales", value: stats.businesses.total },
    { label: "Negocios publicados", value: stats.businesses.published },
    { label: "Clientes", value: stats.clients },
    { label: "Turnos totales", value: totalAppointments },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-2xl font-bold text-neutral-900">{c.value}</p>
            <p className="text-sm text-neutral-500">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-neutral-900 mb-4">Turnos por estado</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(stats.appointmentsByStatus).map(([status, count]) => (
            <div key={status}>
              <p className="text-xl font-bold text-neutral-900">{count}</p>
              <p className="text-sm text-neutral-500">{STATUS_LABEL[status] ?? status}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-neutral-900 mb-4">Altas por semana (últimas 8 semanas)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500 border-b border-neutral-100">
                <th className="py-2 pr-4 font-medium">Semana del</th>
                <th className="py-2 pr-4 font-medium">Negocios</th>
                <th className="py-2 font-medium">Clientes</th>
              </tr>
            </thead>
            <tbody>
              {stats.weeklySignups.map((w) => (
                <tr key={w.weekStart} className="border-b border-neutral-50 last:border-0">
                  <td className="py-2 pr-4 text-neutral-900">{formatWeekLabel(w.weekStart)}</td>
                  <td className="py-2 pr-4 text-neutral-600">{w.businesses}</td>
                  <td className="py-2 text-neutral-600">{w.clients}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

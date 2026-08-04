import Link from "next/link";
import { requireBusinessUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatPrice, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PanelDashboardPage() {
  const user = await requireBusinessUser();
  const businessId = user!.business!.id;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [rawTodayAppointments, weekCount, servicesCount, professionalsCount] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        businessId,
        startsAt: { gte: todayStart, lte: todayEnd },
        status: { in: ["CONFIRMADO", "PENDIENTE"] },
      },
      include: { service: true, professional: true, client: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.appointment.count({
      where: { businessId, startsAt: { gte: now, lte: weekEnd }, status: { in: ["CONFIRMADO", "PENDIENTE"] } },
    }),
    prisma.service.count({ where: { businessId, active: true } }),
    prisma.professional.count({ where: { businessId, active: true } }),
  ]);

  // service/professional/client siempre vienen incluidos por el include de arriba.
  const todayAppointments = rawTodayAppointments.map((a) => ({
    ...a,
    service: a.service!,
    professional: a.professional!,
    client: a.client!,
  }));

  const stats = [
    { label: "Turnos hoy", value: todayAppointments.length },
    { label: "Turnos próximos 7 días", value: weekCount },
    { label: "Servicios activos", value: servicesCount },
    { label: "Profesionales activos", value: professionalsCount },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <p className="text-2xl font-bold text-neutral-900">{s.value}</p>
            <p className="text-sm text-neutral-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-neutral-900">Turnos de hoy</h2>
          <Link href="/panel/agenda" className="text-sm font-semibold text-brand-600">
            Ver agenda completa →
          </Link>
        </div>
        {todayAppointments.length === 0 ? (
          <p className="text-sm text-neutral-500">No tenés turnos agendados para hoy.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {todayAppointments.map((a) => (
              <li key={a.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-neutral-900">
                    {formatTime(a.startsAt)} · {a.service.name}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {a.client.name} {a.client.lastName ?? ""} · con {a.professional.name}
                  </p>
                </div>
                <span className="text-sm font-semibold text-brand-600">{formatPrice(a.service.price)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {servicesCount === 0 && (
        <div className="card p-6 bg-amber-50 border-amber-100">
          <p className="text-sm text-amber-800">
            Todavía no cargaste servicios, así que tu negocio no puede recibir reservas.{" "}
            <Link href="/panel/servicios" className="font-semibold underline">
              Cargá tu primer servicio
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}

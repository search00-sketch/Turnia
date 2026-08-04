import Link from "next/link";
import { requireBusinessUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatDateLong, formatPrice, formatTime } from "@/lib/format";
import AppointmentStatusActions from "@/components/appointment-status-actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  CANCELADO: "Cancelado",
  COMPLETADO: "Completado",
};

const STATUS_STYLE: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-700",
  CONFIRMADO: "bg-green-100 text-green-700",
  CANCELADO: "bg-red-100 text-red-700",
  COMPLETADO: "bg-neutral-100 text-neutral-600",
};

function isoOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Props {
  searchParams: { fecha?: string };
}

export default async function AgendaPage({ searchParams }: Props) {
  const user = await requireBusinessUser();
  const businessId = user!.business!.id;

  const selected = searchParams.fecha ? new Date(`${searchParams.fecha}T00:00:00`) : new Date();
  selected.setHours(0, 0, 0, 0);

  const dayEnd = new Date(selected);
  dayEnd.setHours(23, 59, 59, 999);

  const prevDay = new Date(selected);
  prevDay.setDate(prevDay.getDate() - 1);
  const nextDay = new Date(selected);
  nextDay.setDate(nextDay.getDate() + 1);

  const rawAppointments = await prisma.appointment.findMany({
    where: { businessId, startsAt: { gte: selected, lte: dayEnd } },
    include: { service: true, professional: true, client: true },
    orderBy: { startsAt: "asc" },
  });

  // service/professional/client siempre vienen incluidos por el include de arriba.
  const appointments = rawAppointments.map((a) => ({
    ...a,
    service: a.service!,
    professional: a.professional!,
    client: a.client!,
  }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Link href={`/panel/agenda?fecha=${isoOf(prevDay)}`} className="btn-ghost border border-neutral-200">
            ← Anterior
          </Link>
          <form action="/panel/agenda" className="flex items-center gap-2">
            <input type="date" name="fecha" defaultValue={isoOf(selected)} className="input" />
            <button type="submit" className="btn-secondary">Ir</button>
          </form>
          <Link href={`/panel/agenda?fecha=${isoOf(nextDay)}`} className="btn-ghost border border-neutral-200">
            Siguiente →
          </Link>
        </div>
        <Link href={`/panel/agenda?fecha=${isoOf(new Date())}`} className="text-sm font-semibold text-brand-600">
          Hoy
        </Link>
      </div>

      <h2 className="font-semibold text-neutral-900 capitalize mb-4">{formatDateLong(selected)}</h2>

      {appointments.length === 0 ? (
        <div className="card p-6 text-sm text-neutral-500">No hay turnos para este día.</div>
      ) : (
        <div className="card divide-y divide-neutral-100">
          {appointments.map((a) => (
            <div key={a.id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="text-center w-14 shrink-0">
                  <p className="font-bold text-neutral-900">{formatTime(a.startsAt)}</p>
                </div>
                <div>
                  <span className={`inline-block text-[11px] font-semibold rounded-full px-2 py-0.5 mb-1 ${STATUS_STYLE[a.status]}`}>
                    {STATUS_LABEL[a.status]}
                  </span>
                  <p className="font-medium text-neutral-900">
                    {a.service.name} · {a.client.name} {a.client.lastName ?? ""}
                  </p>
                  <p className="text-sm text-neutral-500">
                    con {a.professional.name} · {formatPrice(a.service.price)}
                    {a.client.phone ? ` · ${a.client.phone}` : ""}
                  </p>
                  {a.notes && <p className="text-xs text-neutral-400 mt-0.5">Nota: {a.notes}</p>}
                </div>
              </div>
              <AppointmentStatusActions appointmentId={a.id} status={a.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

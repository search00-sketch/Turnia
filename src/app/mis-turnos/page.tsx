import Link from "next/link";
import { redirect } from "next/navigation";
import { requireClientUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatDateLong, formatPrice, formatTime } from "@/lib/format";
import CancelAppointmentButton from "@/components/cancel-appointment-button";

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

export default async function MisTurnosPage() {
  const user = await requireClientUser();
  if (!user) redirect("/login?callbackUrl=/mis-turnos");

  const rawAppointments = await prisma.appointment.findMany({
    where: { clientId: user.id },
    include: { business: true, service: true, professional: true },
    orderBy: { startsAt: "desc" },
  });

  // business/service/professional siempre vienen incluidos por el include de arriba.
  const appointments = rawAppointments.map((a) => ({
    ...a,
    business: a.business!,
    service: a.service!,
    professional: a.professional!,
  }));

  const now = new Date();
  const upcoming = appointments
    .filter((a) => a.startsAt >= now && a.status !== "CANCELADO")
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const rest = appointments.filter((a) => !upcoming.includes(a));

  function AppointmentCard({ a, showCancel }: { a: (typeof appointments)[number]; showCancel: boolean }) {
    return (
      <div className="card p-5 flex items-start justify-between gap-4">
        <div>
          <span className={`inline-block text-xs font-semibold rounded-full px-2.5 py-0.5 mb-2 ${STATUS_STYLE[a.status]}`}>
            {STATUS_LABEL[a.status]}
          </span>
          <p className="font-semibold text-neutral-900">
            <Link href={`/negocios/${a.business.slug}`} className="hover:text-brand-600">
              {a.business.name}
            </Link>
          </p>
          <p className="text-sm text-neutral-600">{a.service.name} · con {a.professional.name}</p>
          <p className="text-sm text-neutral-500 mt-1 capitalize">
            {formatDateLong(a.startsAt)} a las {formatTime(a.startsAt)}
          </p>
          <p className="text-sm font-medium text-brand-600 mt-1">{formatPrice(a.service.price)}</p>
        </div>
        {showCancel && (a.status === "CONFIRMADO" || a.status === "PENDIENTE") && (
          <CancelAppointmentButton appointmentId={a.id} />
        )}
      </div>
    );
  }

  return (
    <div className="section py-10 max-w-3xl">
      <h1 className="text-2xl font-bold text-neutral-900 mb-6">Mis turnos</h1>

      <section className="mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-3">
          Próximos turnos
        </h2>
        {upcoming.length === 0 ? (
          <div className="card p-6 text-neutral-500 text-sm">
            No tenés turnos próximos. <Link href="/negocios" className="text-brand-600 font-medium">Reservá uno</Link>.
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((a) => (
              <AppointmentCard key={a.id} a={a} showCancel />
            ))}
          </div>
        )}
      </section>

      {rest.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-3">Historial</h2>
          <div className="space-y-3">
            {rest.map((a) => (
              <AppointmentCard key={a.id} a={a} showCancel={false} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

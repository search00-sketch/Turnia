import Link from "next/link";
import { redirect } from "next/navigation";
import { requireClientUser } from "@/lib/session";
import { getAppointmentsForClient, hydrateForClient } from "@/lib/db/appointments";
import { formatDateLong, formatPrice, formatTime } from "@/lib/format";
import CancelAppointmentButton from "@/components/cancel-appointment-button";
import { Sketch } from "@/components/sketch";
import { IconRoute } from "@/components/icons";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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

function repeatHref(a: { business: { slug: string }; serviceId: string; professionalId: string }) {
  return `/negocios/${a.business.slug}/reservar?servicio=${a.serviceId}&profesional=${a.professionalId}`;
}

export default async function MisTurnosPage() {
  const user = await requireClientUser();
  if (!user) redirect("/login?callbackUrl=/mis-turnos");

  const rawAppointments = await getAppointmentsForClient(user.id);
  const appointments = await hydrateForClient(rawAppointments);

  const now = new Date();
  const upcoming = appointments
    .filter((a) => a.startsAt >= now && a.status !== "CANCELADO")
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const rest = appointments.filter((a) => !upcoming.includes(a));

  const [next, ...laterUpcoming] = upcoming;

  function AppointmentCard({ a, showCancel }: { a: (typeof appointments)[number]; showCancel: boolean }) {
    const canRepeat = !showCancel;
    return (
      <div className="card p-4 sm:p-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className={`inline-block text-[11px] font-bold rounded-full px-2.5 py-0.5 mb-2 ${STATUS_STYLE[a.status]}`}>
            {STATUS_LABEL[a.status]}
          </span>
          <p className="font-extrabold text-plum-900">
            <Link href={`/negocios/${a.business.slug}`} className="hover:text-brand-600">
              {a.business.name}
            </Link>
          </p>
          <p className="text-sm text-plum-600">{a.service.name} · con {a.professional.name}</p>
          <p className="text-sm text-plum-500 mt-1">
            {formatDateLong(a.startsAt)} a las {formatTime(a.startsAt)} · {formatPrice(a.price ?? a.service.price)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {showCancel && (a.status === "CONFIRMADO" || a.status === "PENDIENTE") && (
            <CancelAppointmentButton appointmentId={a.id} />
          )}
          {canRepeat && (
            <Link href={repeatHref(a)} className="text-sm font-bold text-brand-600">
              Repetir
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="section py-8 md:py-10 max-w-3xl">
      <h1 className="text-2xl md:text-3xl font-extrabold text-plum-900 mb-5">Mis turnos</h1>

      {next ? (
        <section className="mb-8 space-y-3">
          <div className="plum-surface relative overflow-hidden rounded-xl2 p-5">
            <Sketch name="sparkle" className="absolute -right-3 -top-3 h-20 w-20 text-brand-300 opacity-40" />
            <p className="text-xs font-extrabold uppercase tracking-wider text-brand-200 mb-3">Tu próximo turno</p>
            <div className="flex items-center gap-4">
              <div className="w-16 shrink-0 rounded-2xl bg-white py-2 text-center text-plum-900 leading-tight">
                <span className="block text-[11px] font-extrabold uppercase text-brand-600">
                  {format(next.startsAt, "EEE", { locale: es })}
                </span>
                <span className="block text-2xl font-extrabold">{format(next.startsAt, "d")}</span>
                <span className="block text-[10px] font-bold uppercase text-plum-400">
                  {format(next.startsAt, "MMM", { locale: es })}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-lg font-extrabold leading-tight">
                  {next.service.name} · {formatTime(next.startsAt)}
                </p>
                <p className="text-sm text-plum-200 mt-0.5">
                  {next.business.name} · con {next.professional.name}
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              {next.business.address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(next.business.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn flex-1 bg-white text-plum-900 py-2"
                >
                  <IconRoute className="h-4 w-4 text-brand-600" />
                  Cómo llegar
                </a>
              )}
              {(next.status === "CONFIRMADO" || next.status === "PENDIENTE") && (
                <div className="flex-1 grid place-items-center rounded-full bg-white/10">
                  <CancelAppointmentButton
                    appointmentId={next.id}
                    className="w-full py-2 text-sm font-bold text-white disabled:opacity-50"
                  />
                </div>
              )}
            </div>
          </div>
          {laterUpcoming.map((a) => (
            <AppointmentCard key={a.id} a={a} showCancel />
          ))}
        </section>
      ) : (
        <section className="mb-8">
          <div className="card flex items-center gap-4 border-dashed p-5">
            <Sketch name="calendar" className="h-14 w-14 shrink-0 text-plum-400" />
            <div>
              <p className="font-extrabold text-plum-900">No tenés turnos próximos</p>
              <p className="text-sm text-plum-500">
                <Link href="/negocios" className="font-bold text-brand-600">Buscá un lugar</Link> y reservá en un minuto.
              </p>
            </div>
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section>
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-plum-400 mb-3">Historial</h2>
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/db/businesses";
import { getServicesByBusiness, type ServiceDoc } from "@/lib/db/services";
import { getHoursByBusiness } from "@/lib/db/hours";
import { getProfessionalsByBusiness } from "@/lib/db/professionals";
import { categoryLabel, DAYS_OF_WEEK } from "@/lib/config";
import { formatDuration, formatPrice } from "@/lib/format";
import { getOpenStatus } from "@/lib/open-status";
import Avatar from "@/components/avatar";
import { CategoryScene, Sketch, Underlined } from "@/components/sketch";
import { IconBack, IconChat, IconClock, IconPhone, IconPlus, IconRoute } from "@/components/icons";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export default async function BusinessDetailPage({ params }: Props) {
  const business = await getBusinessBySlug(params.slug);
  if (!business || !business.published) notFound();

  const [services, hours, professionals] = await Promise.all([
    getServicesByBusiness(business.id, { activeOnly: true }),
    getHoursByBusiness(business.id),
    getProfessionalsByBusiness(business.id, { activeOnly: true }),
  ]);

  // Sin servicios o sin profesionales no se puede reservar (y no aparece en el buscador).
  const bookable = services.length > 0 && professionals.length > 0;
  const minPrice = services.length ? Math.min(...services.map((s) => s.price)) : null;
  const status = getOpenStatus(hours);
  const reservarHref = `/negocios/${business.slug}/reservar`;

  const servicesByCategory = new Map<string, ServiceDoc[]>();
  for (const service of services) {
    const list = servicesByCategory.get(service.category) ?? [];
    list.push(service);
    servicesByCategory.set(service.category, list);
  }

  const quickActions = [
    business.address && {
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`,
      label: "Cómo llegar",
      Icon: IconRoute,
    },
    business.whatsapp && {
      href: `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(`¡Hola! Quiero consultar por ${business.name}`)}`,
      label: "WhatsApp",
      Icon: IconChat,
    },
    business.phone && { href: `tel:${business.phone}`, label: "Llamar", Icon: IconPhone },
  ].filter(Boolean) as { href: string; label: string; Icon: typeof IconRoute }[];

  return (
    <div>
      {/* Portada */}
      <div className="relative h-56 md:h-72 w-full overflow-hidden">
        {business.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={business.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <CategoryScene category={business.category} className="absolute inset-0 pb-10" large />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-plum-900/85 via-plum-900/20 to-transparent" />
        <Link
          href="/negocios"
          aria-label="Volver"
          className="md:hidden absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-plum-900"
        >
          <IconBack className="h-4 w-4" />
        </Link>
        <div className="section absolute inset-x-0 bottom-0 pb-5 text-white">
          <p className="text-xs font-extrabold uppercase tracking-wider text-brand-200">
            {categoryLabel(business.category)}
            {business.neighborhood ? ` · ${business.neighborhood}` : ""}
          </p>
          <h1 className="mt-1 text-2xl md:text-4xl font-extrabold tracking-tight">{business.name}</h1>
        </div>
      </div>

      <div className="section py-5 md:py-8 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 space-y-5">
          {quickActions.length > 0 && (
            <div className="grid gap-2 lg:hidden" style={{ gridTemplateColumns: `repeat(${quickActions.length}, minmax(0, 1fr))` }}>
              {quickActions.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel="noreferrer"
                  className="card flex flex-col items-center gap-1 py-3 text-xs font-bold text-plum-900"
                >
                  <Icon className="h-5 w-5 text-brand-600" />
                  {label}
                </a>
              ))}
            </div>
          )}

          {(status || hours.length > 0) && (
            <details className="card px-4 py-3 lg:hidden group">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-plum-600">
                <IconClock className={`h-4 w-4 ${status?.open ? "text-emerald-700" : "text-amber-700"}`} />
                {status ? (
                  <span>
                    <b className={status.open ? "text-emerald-700" : "text-amber-700"}>{status.open ? "Abierto" : "Cerrado"}</b>
                    {" · "}
                    {status.open ? status.label.replace("Abierto · ", "") : status.label}
                  </span>
                ) : (
                  <span>Horarios</span>
                )}
                <span className="ml-auto text-xs font-bold text-brand-600 group-open:hidden">Ver horarios</span>
              </summary>
              <HoursList hours={hours} className="mt-3" />
            </details>
          )}

          {!bookable && (
            <p className="text-sm text-amber-800 bg-amber-50 rounded-xl px-4 py-3">
              Este negocio todavía no está tomando reservas online. Podés contactarlo por teléfono o WhatsApp.
            </p>
          )}

          {business.description && (
            <div className="card p-5 md:p-6">
              <h2 className="font-extrabold text-plum-900 mb-2">Sobre el lugar</h2>
              <p className="text-plum-600 text-sm leading-relaxed">{business.description}</p>
            </div>
          )}

          <div id="servicios" className="space-y-4">
            <h2 className="text-lg font-extrabold text-plum-900">
              <Underlined className="text-brand-500">Servicios</Underlined>
            </h2>
            {servicesByCategory.size === 0 && (
              <p className="text-plum-500 text-sm">Este negocio todavía no cargó servicios.</p>
            )}
            {Array.from(servicesByCategory.entries()).map(([category, list]) => (
              <div key={category} className="card overflow-hidden">
                <h3 className="px-5 pt-4 text-[11px] font-extrabold uppercase tracking-wider text-plum-400">{category}</h3>
                <ul className="divide-y divide-plum-100">
                  {list.map((service) => (
                    <li key={service.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-plum-900">{service.name}</p>
                        <p className="text-sm text-plum-500">
                          {formatDuration(service.durationMin)}
                          {service.description ? ` · ${service.description}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 font-extrabold text-plum-900">{formatPrice(service.price)}</span>
                      {bookable && (
                        <Link
                          href={`${reservarHref}?servicio=${service.id}`}
                          aria-label={`Reservar ${service.name}`}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-brand-600 text-brand-600 hover:bg-brand-600 hover:text-white transition-colors"
                        >
                          <IconPlus className="h-4 w-4" />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {professionals.length > 0 && (
            <div className="card p-5 lg:hidden">
              <h2 className="font-extrabold text-plum-900 mb-3">Profesionales</h2>
              <ProfessionalsList professionals={professionals} />
            </div>
          )}
        </div>

        {/* Columna lateral (compu) */}
        <aside className="hidden lg:block space-y-5">
          {bookable && (
            <div className="card p-6 space-y-3">
              {minPrice !== null && <p className="text-sm text-plum-500">Servicios desde <b className="text-plum-900">{formatPrice(minPrice)}</b></p>}
              <Link href={reservarHref} className="btn-primary w-full">Reservar turno</Link>
            </div>
          )}
          {quickActions.length > 0 && (
            <div className="card p-6 space-y-3">
              <h2 className="font-extrabold text-plum-900">Contacto</h2>
              {business.address && <p className="text-sm text-plum-600">{business.address}</p>}
              <div className="flex flex-wrap gap-2">
                {quickActions.map(({ href, label, Icon }) => (
                  <a key={label} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="btn-secondary px-3.5 py-2">
                    <Icon className="h-4 w-4 text-brand-600" />
                    {label}
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="card p-6">
            <h2 className="font-extrabold text-plum-900 mb-1">Horarios</h2>
            {status && (
              <p className={`text-sm font-bold mb-3 ${status.open ? "text-emerald-700" : "text-amber-700"}`}>{status.label}</p>
            )}
            <HoursList hours={hours} />
          </div>
          {professionals.length > 0 && (
            <div className="card p-6 relative overflow-hidden">
              <Sketch name="sparkle" className="absolute -right-2 -top-2 h-14 w-14 text-brand-200" />
              <h2 className="font-extrabold text-plum-900 mb-3">Profesionales</h2>
              <ProfessionalsList professionals={professionals} />
            </div>
          )}
        </aside>
      </div>

      {/* Botón fijo para reservar (celular) */}
      {bookable && (
        <>
          <div className="h-20 lg:hidden" aria-hidden="true" />
          <div
            className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-plum-100 bg-white/95 backdrop-blur"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div className="section flex items-center gap-3 py-3">
              {minPrice !== null && (
                <div className="leading-tight">
                  <p className="text-xs text-plum-500">Desde</p>
                  <p className="font-extrabold text-plum-900">{formatPrice(minPrice)}</p>
                </div>
              )}
              <Link href={reservarHref} className="btn-primary ml-auto px-7 py-3">
                Reservar turno
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function HoursList({ hours, className = "" }: { hours: { dayOfWeek: number; isClosed: boolean; openTime: string | null; closeTime: string | null }[]; className?: string }) {
  const today = new Date().getDay();
  return (
    <ul className={`text-sm space-y-1.5 ${className}`}>
      {hours.map((h) => (
        <li key={h.dayOfWeek} className={`flex justify-between ${h.dayOfWeek === today ? "font-bold text-plum-900" : "text-plum-600"}`}>
          <span>{DAYS_OF_WEEK[h.dayOfWeek]}</span>
          <span className={h.isClosed ? "text-plum-300" : ""}>{h.isClosed ? "Cerrado" : `${h.openTime} – ${h.closeTime}`}</span>
        </li>
      ))}
    </ul>
  );
}

function ProfessionalsList({ professionals }: { professionals: { id: string; name: string; photo: string | null }[] }) {
  return (
    <ul className="space-y-2.5 text-sm text-plum-700">
      {professionals.map((p) => (
        <li key={p.id} className="flex items-center gap-3">
          <Avatar name={p.name} src={p.photo} size={36} />
          <span className="font-semibold">{p.name}</span>
        </li>
      ))}
    </ul>
  );
}

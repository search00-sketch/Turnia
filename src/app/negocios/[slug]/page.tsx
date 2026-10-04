import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/db/businesses";
import { getServicesByBusiness, type ServiceDoc } from "@/lib/db/services";
import { getHoursByBusiness } from "@/lib/db/hours";
import { getProfessionalsByBusiness } from "@/lib/db/professionals";
import { categoryLabel, DAYS_OF_WEEK } from "@/lib/config";
import { formatDuration, formatPrice } from "@/lib/format";
import Avatar from "@/components/avatar";

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

  const servicesByCategory = new Map<string, ServiceDoc[]>();
  for (const service of services) {
    const list = servicesByCategory.get(service.category) ?? [];
    list.push(service);
    servicesByCategory.set(service.category, list);
  }

  const whatsappHref = business.whatsapp
    ? `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(`Hola! Quiero consultar por ${business.name}`)}`
    : null;

  return (
    <div>
      <div className="relative h-48 sm:h-64 w-full bg-gradient-to-br from-brand-200 to-brand-400 flex items-end overflow-hidden">
        {business.coverImage && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={business.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          </>
        )}
        <div className="section pb-6 relative">
          <span className="inline-block text-xs font-semibold uppercase tracking-wide bg-white/90 text-brand-700 rounded-full px-3 py-1 mb-2">
            {categoryLabel(business.category)}
          </span>
          <h1 className="text-3xl font-extrabold text-white drop-shadow">{business.name}</h1>
        </div>
      </div>

      <div className="section py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {business.description && (
            <div className="card p-6">
              <h2 className="font-semibold text-neutral-900 mb-2">Descripción</h2>
              <p className="text-neutral-600 text-sm leading-relaxed">{business.description}</p>
            </div>
          )}

          <div id="servicios" className="space-y-6">
            <h2 className="font-semibold text-neutral-900 text-lg">Servicios</h2>
            {!bookable && (
              <p className="text-sm text-amber-800 bg-amber-50 rounded-lg px-4 py-3">
                Este negocio todavía no está tomando reservas online. Podés contactarlo por teléfono o WhatsApp.
              </p>
            )}
            {servicesByCategory.size === 0 && (
              <p className="text-neutral-500 text-sm">Este negocio todavía no cargó servicios.</p>
            )}
            {Array.from(servicesByCategory.entries()).map(([category, services]) => (
              <div key={category} className="card p-6">
                <h3 className="text-xs font-bold uppercase tracking-wide text-brand-600 mb-4">
                  {category}
                </h3>
                <ul className="divide-y divide-neutral-100">
                  {services.map((service) => (
                    <li key={service.id} className="py-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-neutral-900">{service.name}</p>
                        {service.description && (
                          <p className="text-sm text-neutral-500 mt-0.5">{service.description}</p>
                        )}
                        <p className="text-sm text-neutral-400 mt-1">
                          {formatDuration(service.durationMin)} · {formatPrice(service.price)}
                        </p>
                      </div>
                      {bookable && (
                        <Link
                          href={`/negocios/${business.slug}/reservar?servicio=${service.id}`}
                          className="btn-primary shrink-0"
                        >
                          Reservar
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="font-semibold text-neutral-900 mb-4">Información</h2>
            <ul className="space-y-3 text-sm text-neutral-600">
              {business.address && (
                <li className="flex gap-2">
                  <span aria-hidden>📍</span>
                  <span>{business.address}</span>
                </li>
              )}
              {business.phone && (
                <li className="flex gap-2">
                  <span aria-hidden>📞</span>
                  <a href={`tel:${business.phone}`} className="hover:text-brand-600">{business.phone}</a>
                </li>
              )}
              {whatsappHref && (
                <li className="flex gap-2">
                  <span aria-hidden>💬</span>
                  <a href={whatsappHref} target="_blank" rel="noreferrer" className="hover:text-brand-600">
                    Enviar WhatsApp
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div className="card p-6">
            <h2 className="font-semibold text-neutral-900 mb-4">Horarios de atención</h2>
            <ul className="text-sm text-neutral-600 space-y-1.5">
              {hours.map((h) => (
                <li key={h.dayOfWeek} className="flex justify-between">
                  <span>{DAYS_OF_WEEK[h.dayOfWeek]}</span>
                  <span className={h.isClosed ? "text-neutral-400" : ""}>
                    {h.isClosed ? "Cerrado" : `${h.openTime} – ${h.closeTime}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {professionals.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-neutral-900 mb-4">Profesionales</h2>
              <ul className="text-sm text-neutral-600 space-y-2.5">
                {professionals.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <Avatar name={p.name} src={p.photo} size={36} />
                    <span>{p.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

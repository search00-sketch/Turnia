import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/db/businesses";
import { getServicesByBusiness } from "@/lib/db/services";
import { getProfessionalsByBusiness } from "@/lib/db/professionals";
import { getHoursByBusiness } from "@/lib/db/hours";
import { getCurrentUser } from "@/lib/session";
import BookingWizard from "@/components/booking-wizard";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
  searchParams: { servicio?: string; profesional?: string; fecha?: string; hora?: string };
}

export default async function ReservarPage({ params, searchParams }: Props) {
  const business = await getBusinessBySlug(params.slug);
  if (!business || !business.published) notFound();

  const [services, professionals, user, hours] = await Promise.all([
    getServicesByBusiness(business.id, { activeOnly: true }),
    getProfessionalsByBusiness(business.id, { activeOnly: true }),
    getCurrentUser(),
    getHoursByBusiness(business.id),
  ]);

  // Días de la semana (0 = domingo) en los que el negocio atiende: el resto se muestra en gris.
  const openDays = hours.filter((h) => !h.isClosed && h.openTime && h.closeTime).map((h) => h.dayOfWeek);

  if (services.length === 0 || professionals.length === 0) {
    return (
      <div className="section py-16 text-center text-neutral-500">
        Este negocio todavía no está tomando reservas online.
      </div>
    );
  }

  return (
    <div className="section py-10">
      <h1 className="text-2xl font-bold text-neutral-900 mb-1 text-center">Reservar en {business.name}</h1>
      <p className="text-neutral-500 text-center mb-8">{business.address}</p>

      <BookingWizard
        business={{ id: business.id, slug: business.slug, name: business.name, address: business.address }}
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          price: s.price,
          durationMin: s.durationMin,
          description: s.description,
        }))}
        professionals={professionals.map((p) => ({ id: p.id, name: p.name }))}
        openDays={openDays}
        initial={searchParams}
        user={user ? { id: user.id, role: user.role } : null}
      />
    </div>
  );
}

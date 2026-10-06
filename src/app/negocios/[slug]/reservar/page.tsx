import Link from "next/link";
import { notFound } from "next/navigation";
import { businessMetadata, getBusinessBySlugCached } from "@/lib/business-metadata";
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

export function generateMetadata({ params }: { params: { slug: string } }) {
  return businessMetadata(params.slug, { booking: true });
}

export default async function ReservarPage({ params, searchParams }: Props) {
  const business = await getBusinessBySlugCached(params.slug);
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
    <div className="section py-6 md:py-10">
      <div className="max-w-2xl mx-auto mb-5">
        <Link href={`/negocios/${business.slug}`} className="text-sm font-bold text-brand-600">
          ← {business.name}
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold text-plum-900">Reservá tu turno</h1>
      </div>

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
        professionals={professionals.map((p) => ({ id: p.id, name: p.name, photo: p.photo }))}
        openDays={openDays}
        initial={searchParams}
        user={user ? { id: user.id, role: user.role } : null}
      />
    </div>
  );
}

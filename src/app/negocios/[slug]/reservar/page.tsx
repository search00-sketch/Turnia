import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import BookingWizard from "@/components/booking-wizard";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
  searchParams: { servicio?: string; profesional?: string; fecha?: string; hora?: string };
}

export default async function ReservarPage({ params, searchParams }: Props) {
  const [business, user] = await Promise.all([
    prisma.business.findUnique({
      where: { slug: params.slug },
      include: {
        services: { where: { active: true }, orderBy: { name: "asc" } },
        professionals: { where: { active: true } },
      },
    }),
    getCurrentUser(),
  ]);

  if (!business || !business.published) notFound();

  const services = business.services ?? [];
  const professionals = business.professionals ?? [];

  if (services.length === 0) {
    return (
      <div className="section py-16 text-center text-neutral-500">
        Este negocio todavía no cargó servicios para reservar.
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
        initial={searchParams}
        user={user ? { id: user.id, role: user.role } : null}
      />
    </div>
  );
}

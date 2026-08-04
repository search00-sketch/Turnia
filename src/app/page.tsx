import Link from "next/link";
import { getPublishedBusinesses } from "@/lib/db/businesses";
import { CATEGORIES } from "@/lib/config";
import BusinessCard from "@/components/business-card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const businesses = await getPublishedBusinesses({ take: 8 });

  return (
    <div>
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="section py-16 sm:py-24 text-center">
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-900">
            Reservá turnos en los mejores <br className="hidden sm:block" />
            <span className="text-brand-600">negocios de belleza y bienestar</span>
          </h1>
          <p className="mt-4 text-neutral-500 max-w-xl mx-auto">
            Elegí un negocio, un profesional, el día y la hora. Confirmá tu turno en menos de un minuto.
          </p>

          <form action="/negocios" className="mt-8 max-w-xl mx-auto flex gap-2">
            <input
              type="text"
              name="q"
              placeholder="Buscá por negocio o servicio, ej: corte, manicura..."
              className="input flex-1 bg-white"
            />
            <button type="submit" className="btn-primary shrink-0">
              Buscar
            </button>
          </form>
        </div>
      </section>

      <section className="section py-10">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">Servicios más solicitados</h2>
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.filter((c) => c.slug !== "otros").map((c) => (
            <Link
              key={c.slug}
              href={`/negocios?categoria=${c.slug}`}
              className="btn-secondary"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="section py-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-neutral-900">Negocios destacados</h2>
          <Link href="/negocios" className="text-sm font-semibold text-brand-600">
            Ver todos →
          </Link>
        </div>

        {businesses.length === 0 ? (
          <p className="text-neutral-500">
            Todavía no hay negocios publicados. ¡Sé el primero!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {businesses.map((b) => (
              <BusinessCard key={b.slug} business={b} />
            ))}
          </div>
        )}
      </section>

      <section className="section py-16">
        <div className="card bg-brand-600 text-white p-10 text-center rounded-xl2">
          <h2 className="text-2xl font-bold">¿Tenés un negocio de belleza o bienestar?</h2>
          <p className="mt-2 text-brand-50 max-w-xl mx-auto">
            Publicalo gratis, cargá tus servicios y empezá a recibir reservas online las 24hs.
          </p>
          <Link href="/publica-tu-negocio" className="btn-secondary mt-6 inline-flex bg-white">
            Publicá tu negocio
          </Link>
        </div>
      </section>
    </div>
  );
}

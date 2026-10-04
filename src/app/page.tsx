import Link from "next/link";
import { getMarketplaceCards } from "@/lib/db/marketplace";
import BusinessCard from "@/components/business-card";
import CategoryChips from "@/components/category-chips";
import InstallPrompt from "@/components/install-prompt";
import { Sketch, Underlined } from "@/components/sketch";
import { IconSearch } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const businesses = await getMarketplaceCards({ take: 8 });

  return (
    <div>
      <section className="plum-surface relative overflow-hidden rounded-b-[28px] md:rounded-none">
        {/* dibujos a lápiz de fondo */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 max-w-md text-brand-300 opacity-40 md:opacity-50" aria-hidden="true">
          <Sketch name="scissors" className="absolute right-3 top-3 h-14 w-14 md:right-6 md:top-6 md:h-32 md:w-32 rotate-12" />
          <Sketch name="comb" className="absolute hidden md:block md:right-44 md:top-36 md:h-24 md:w-24 -rotate-12" />
          <Sketch name="sparkle" className="absolute right-3 bottom-3 h-8 w-8 md:right-4 md:bottom-6 md:h-14 md:w-14" />
        </div>
        <div className="section relative py-10 md:py-20">
          <h1 className="max-w-xl text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.1]">
            ¿Qué te querés hacer <Underlined>hoy?</Underlined>
          </h1>
          <p className="mt-4 max-w-md text-plum-200">
            Peluquerías, barberías, uñas y spas cerca tuyo. Elegí día y hora y reservá en un minuto.
          </p>
          <form action="/negocios" className="mt-6 max-w-xl flex gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Buscar</span>
              <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-plum-400" />
              <input
                type="text"
                name="q"
                placeholder="Corte, uñas, masajes…"
                className="input border-transparent pl-10 py-3"
              />
            </label>
            <button type="submit" className="btn-primary shrink-0 hidden sm:inline-flex">
              Buscar
            </button>
          </form>
        </div>
      </section>

      <section className="section pt-5 md:pt-8">
        <CategoryChips />
      </section>

      <section className="section pt-4">
        <InstallPrompt />
      </section>

      <section className="section py-6 md:py-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-lg md:text-xl font-extrabold text-plum-900">Negocios para reservar</h2>
          <Link href="/negocios" className="text-sm font-bold text-brand-600">
            Ver todos
          </Link>
        </div>

        {businesses.length === 0 ? (
          <div className="card p-8 text-center text-plum-500">
            <Sketch name="mirror" className="mx-auto mb-3 h-14 w-14 text-plum-300" />
            Todavía no hay negocios publicados. ¡Sé el primero!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {businesses.map((b) => (
              <BusinessCard key={b.slug} business={b} />
            ))}
          </div>
        )}
      </section>

      <section className="section py-8 md:py-14">
        <div className="sand-surface relative overflow-hidden rounded-xl2 p-8 md:p-10">
          <Sketch name="dryer" className="pointer-events-none absolute -right-4 -bottom-4 h-32 w-32 text-plum-700 opacity-25" />
          <h2 className="text-2xl font-extrabold text-plum-900 max-w-md">¿Tenés un negocio de belleza o bienestar?</h2>
          <p className="mt-2 text-plum-600 max-w-md">
            Publicalo gratis, cargá tus servicios y empezá a recibir reservas online las 24 hs.
          </p>
          <Link href="/publica-tu-negocio" className="btn-primary mt-6">
            Publicá tu negocio
          </Link>
        </div>
      </section>
    </div>
  );
}

import Link from "next/link";
import { getPublishedBusinesses } from "@/lib/db/businesses";
import { getServicesForBusinesses } from "@/lib/db/services";
import { CATEGORIES } from "@/lib/config";
import BusinessCard from "@/components/business-card";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { q?: string; categoria?: string };
}

export default async function NegociosPage({ searchParams }: Props) {
  const q = searchParams.q?.trim().toLowerCase() || "";
  const categoria = searchParams.categoria || "";

  let businesses = await getPublishedBusinesses(categoria ? { category: categoria } : {});

  if (q) {
    const services = await getServicesForBusinesses(businesses.map((b) => b.id));
    const businessIdsWithMatchingService = new Set(
      services.filter((s) => s.name.toLowerCase().includes(q)).map((s) => s.businessId)
    );
    businesses = businesses.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.description?.toLowerCase().includes(q) ?? false) ||
        businessIdsWithMatchingService.has(b.id)
    );
  }

  return (
    <div className="section py-10">
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">Explorá negocios</h1>
      <p className="text-neutral-500 mb-6">
        {businesses.length} negocio{businesses.length !== 1 ? "s" : ""} disponible{businesses.length !== 1 ? "s" : ""}
        {categoria ? ` en ${CATEGORIES.find((c) => c.slug === categoria)?.label ?? categoria}` : ""}
        {q ? ` para "${q}"` : ""}
      </p>

      <form action="/negocios" className="flex gap-2 mb-6 max-w-lg">
        {categoria && <input type="hidden" name="categoria" value={categoria} />}
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscá por negocio o servicio..."
          className="input flex-1"
        />
        <button type="submit" className="btn-primary shrink-0">Buscar</button>
      </form>

      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          href={q ? `/negocios?q=${encodeURIComponent(q)}` : "/negocios"}
          className={categoria ? "btn-ghost border border-neutral-200" : "btn-primary"}
        >
          Todas las categorías
        </Link>
        {CATEGORIES.map((c) => {
          const href = `/negocios?categoria=${c.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
          const active = categoria === c.slug;
          return (
            <Link
              key={c.slug}
              href={href}
              className={active ? "btn-primary" : "btn-ghost border border-neutral-200"}
            >
              {c.label}
            </Link>
          );
        })}
      </div>

      {businesses.length === 0 ? (
        <div className="card p-10 text-center text-neutral-500">
          No encontramos negocios con esos filtros. Probá con otra búsqueda.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {businesses.map((b) => (
            <BusinessCard key={b.slug} business={b} />
          ))}
        </div>
      )}
    </div>
  );
}

import { getMarketplaceCards } from "@/lib/db/marketplace";
import { getServicesForBusinesses } from "@/lib/db/services";
import { CATEGORIES } from "@/lib/config";
import CategoryChips from "@/components/category-chips";
import { Sketch } from "@/components/sketch";
import { IconSearch } from "@/components/icons";
import BusinessCard from "@/components/business-card";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { q?: string; categoria?: string };
}

export default async function NegociosPage({ searchParams }: Props) {
  const q = searchParams.q?.trim().toLowerCase() || "";
  const categoria = searchParams.categoria || "";

  let businesses = await getMarketplaceCards(categoria ? { category: categoria } : {});

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
    <div className="section py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-extrabold text-plum-900 mb-1">Explorá negocios</h1>
      <p className="text-plum-500 mb-5">
        {businesses.length} negocio{businesses.length !== 1 ? "s" : ""} para reservar
        {categoria ? ` en ${CATEGORIES.find((c) => c.slug === categoria)?.label ?? categoria}` : ""}
        {q ? ` para "${q}"` : ""}
      </p>

      <form action="/negocios" className="flex gap-2 mb-4 max-w-lg">
        {categoria && <input type="hidden" name="categoria" value={categoria} />}
        <label className="relative flex-1">
          <span className="sr-only">Buscar</span>
          <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-plum-400" />
          <input type="text" name="q" defaultValue={q} placeholder="Buscá por negocio o servicio…" className="input pl-10" />
        </label>
        <button type="submit" className="btn-primary shrink-0">Buscar</button>
      </form>

      <div className="mb-6">
        <CategoryChips active={categoria} query={q} />
      </div>

      {businesses.length === 0 ? (
        <div className="card p-10 text-center text-plum-500">
          <Sketch name="comb" className="mx-auto mb-3 h-14 w-14 text-plum-300" />
          No encontramos negocios con esos filtros. Probá con otra búsqueda.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {businesses.map((b) => (
            <BusinessCard key={b.slug} business={b} />
          ))}
        </div>
      )}
    </div>
  );
}

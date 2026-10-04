import Link from "next/link";
import { CATEGORIES } from "@/lib/config";
import { CATEGORY_SKETCH, Sketch } from "@/components/sketch";

/** Categorías como chips con su dibujo a lápiz. `active` = slug elegido ("" = todas). */
export default function CategoryChips({ active, query = "" }: { active?: string; query?: string }) {
  const q = query ? `q=${encodeURIComponent(query)}` : "";
  const items = [
    { slug: "", label: "Todo", href: q ? `/negocios?${q}` : "/negocios", sketch: "sparkle" as const },
    ...CATEGORIES.filter((c) => c.slug !== "otros").map((c) => ({
      slug: c.slug,
      label: c.label,
      href: `/negocios?categoria=${c.slug}${q ? `&${q}` : ""}`,
      sketch: CATEGORY_SKETCH[c.slug] ?? ("sparkle" as const),
    })),
  ];
  return (
    <div className="-mx-4 px-4 flex gap-2 overflow-x-auto pb-1 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
      {items.map((c) => {
        const on = active !== undefined && active === c.slug;
        return (
          <Link
            key={c.slug || "todo"}
            href={c.href}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-bold transition-colors ${
              on
                ? "bg-plum-900 border-plum-900 text-white"
                : "bg-white border-plum-100 text-plum-900 hover:border-plum-300"
            }`}
          >
            <Sketch name={c.sketch} className={`h-4 w-4 ${on ? "text-brand-300" : "text-brand-600"}`} />
            {c.label}
          </Link>
        );
      })}
    </div>
  );
}

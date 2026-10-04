import Link from "next/link";
import { categoryLabel } from "@/lib/config";
import { formatPrice } from "@/lib/format";
import { CategoryScene } from "@/components/sketch";
import { IconPin } from "@/components/icons";

export interface BusinessCardData {
  slug: string;
  name: string;
  category: string;
  address: string | null;
  neighborhood: string | null;
  coverImage: string | null;
  minPrice: number | null;
  status: { open: boolean; label: string } | null;
}

export default function BusinessCard({ business }: { business: BusinessCardData }) {
  return (
    <Link
      href={`/negocios/${business.slug}`}
      className="card group overflow-hidden hover:shadow-cardHover transition-shadow"
    >
      <div className="relative h-36 w-full overflow-hidden">
        {business.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={business.coverImage}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <CategoryScene category={business.category} className="h-full w-full" />
        )}
        {business.status && (
          <span
            className={`absolute left-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-extrabold ${
              business.status.open ? "text-emerald-700" : "text-amber-700"
            }`}
          >
            ● {business.status.label}
          </span>
        )}
      </div>
      <div className="p-4 space-y-1">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-plum-400">
          {categoryLabel(business.category)}
        </span>
        <h3 className="font-extrabold text-plum-900 truncate">{business.name}</h3>
        <p className="flex items-center gap-1.5 text-sm text-plum-500 min-w-0">
          {(business.neighborhood || business.address) && (
            <>
              <IconPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{business.neighborhood || business.address}</span>
            </>
          )}
          {business.minPrice !== null && (
            <span className="ml-auto shrink-0 font-bold text-plum-900">desde {formatPrice(business.minPrice)}</span>
          )}
        </p>
      </div>
    </Link>
  );
}

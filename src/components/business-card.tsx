import Link from "next/link";
import { categoryLabel } from "@/lib/config";

export interface BusinessCardData {
  slug: string;
  name: string;
  category: string;
  address: string | null;
  coverImage: string | null;
}

export default function BusinessCard({ business }: { business: BusinessCardData }) {
  const initials = business.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <Link
      href={`/negocios/${business.slug}`}
      className="card group overflow-hidden hover:shadow-cardHover transition-shadow"
    >
      <div className="h-36 w-full bg-gradient-to-br from-brand-100 to-brand-300 flex items-center justify-center overflow-hidden">
        {business.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={business.coverImage}
            alt={business.name}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <span className="text-3xl font-bold text-brand-700">{initials}</span>
        )}
      </div>
      <div className="p-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          {categoryLabel(business.category)}
        </span>
        <h3 className="font-semibold text-neutral-900 mt-1 truncate">{business.name}</h3>
        {business.address && (
          <p className="text-sm text-neutral-500 mt-0.5 truncate">{business.address}</p>
        )}
        <span className="inline-block mt-3 text-sm font-semibold text-brand-600">
          Reservar →
        </span>
      </div>
    </Link>
  );
}

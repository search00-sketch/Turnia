import { cache } from "react";
import type { Metadata } from "next";
import { getBusinessBySlug } from "@/lib/db/businesses";
import { appUrl } from "@/lib/unsubscribe";
import { APP_NAME, categoryLabel } from "@/lib/config";

/** Una sola lectura por request aunque la usen generateMetadata y la página. */
export const getBusinessBySlugCached = cache(getBusinessBySlug);

/**
 * Título, descripción y foto que muestran WhatsApp, Instagram y Facebook
 * cuando se comparte el link del negocio o de su página de reserva.
 */
export async function businessMetadata(slug: string, { booking }: { booking: boolean }): Promise<Metadata> {
  const business = await getBusinessBySlugCached(slug);
  if (!business || !business.published) return {};

  const title = booking ? `Reservá tu turno en ${business.name}` : `${business.name} — ${categoryLabel(business.category)}`;
  const description =
    business.description?.slice(0, 160) ||
    `Elegí servicio, día y horario y reservá online en ${business.name}${business.address ? ` (${business.address})` : ""}.`;

  return {
    metadataBase: new URL(appUrl()),
    title: `${title} | ${APP_NAME}`,
    description,
    openGraph: {
      title,
      description,
      siteName: APP_NAME,
      type: "website",
      locale: "es_AR",
      url: `/negocios/${business.slug}${booking ? "/reservar" : ""}`,
      ...(business.coverImage ? { images: [{ url: business.coverImage }] } : {}),
    },
  };
}

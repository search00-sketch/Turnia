import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { mapBusinessDoc } from "@/lib/db/businesses";
import { getBookableInfo } from "@/lib/db/bookable";
import { getHoursForBusinesses } from "@/lib/db/hours";
import { getOpenStatus, type OpenStatus } from "@/lib/open-status";
import type { BusinessCardData } from "@/components/business-card";

/**
 * Negocios visibles en el marketplace (publicados, con al menos un servicio y
 * un profesional activos), listos para las tarjetas: con "desde $" y si están
 * abiertos ahora.
 */
export async function getMarketplaceCards(
  opts: { category?: string; take?: number } = {}
): Promise<(BusinessCardData & { id: string; description: string | null })[]> {
  let query: FirebaseFirestore.Query = getAdminDb()
    .collection(COLLECTIONS.businesses)
    .where("published", "==", true);
  if (opts.category) query = query.where("category", "==", opts.category);

  const published = (await query.get()).docs.map(mapBusinessDoc);
  const info = await getBookableInfo(published.map((b) => b.id));
  let visible = published.filter((b) => info.has(b.id));
  visible.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (opts.take) visible = visible.slice(0, opts.take);

  const hours = await getHoursForBusinesses(visible.map((b) => b.id));
  const now = new Date();

  return visible.map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    category: b.category,
    description: b.description,
    address: b.address,
    neighborhood: b.neighborhood,
    coverImage: b.coverImage,
    minPrice: info.get(b.id)!.minPrice,
    status: getOpenStatus(hours.get(b.id) ?? [], now) as OpenStatus | null,
  }));
}

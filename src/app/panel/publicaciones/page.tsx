import Link from "next/link";
import { requireBusinessUser } from "@/lib/session";
import { getServicesByBusiness } from "@/lib/db/services";
import { getProfessionalsByBusiness } from "@/lib/db/professionals";
import { appUrl } from "@/lib/unsubscribe";
import ShareStudio from "@/components/share-studio";

export const dynamic = "force-dynamic";

export default async function PublicacionesPage() {
  const user = await requireBusinessUser();
  const business = user!.business!;
  const [services, professionals] = await Promise.all([
    getServicesByBusiness(business.id, { activeOnly: true }),
    getProfessionalsByBusiness(business.id, { activeOnly: true }),
  ]);

  const missing = [
    services.length === 0 && { href: "/panel/servicios", label: "un servicio" },
    professionals.length === 0 && { href: "/panel/profesionales", label: "un profesional" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-plum-900">Publicaciones</h2>
        <p className="text-sm text-neutral-500">
          Imágenes listas para tus historias y posts de Instagram y tu estado de WhatsApp, con el link para que te
          reserven directo.
        </p>
      </div>

      {!business.published && (
        <p className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
          Tu negocio no está publicado: el link de reserva no va a funcionar hasta que lo publiquen.
        </p>
      )}

      {missing.length > 0 ? (
        <div className="card p-6 text-sm text-neutral-600">
          Para armar publicaciones, primero cargá{" "}
          {missing.map((m, i) => (
            <span key={m.href}>
              {i > 0 && " y "}
              <Link href={m.href} className="font-semibold text-brand-600 underline">
                {m.label}
              </Link>
            </span>
          ))}
          : sin eso todavía no te pueden reservar.
        </div>
      ) : (
        <ShareStudio
          business={{
            name: business.name,
            slug: business.slug,
            whatsapp: business.whatsapp,
            coverUrl: business.coverImage,
          }}
          link={`${appUrl()}/negocios/${business.slug}/reservar`}
          services={services.map((s) => ({
            id: s.id,
            name: s.name,
            category: s.category,
            price: s.price,
            durationMin: s.durationMin,
          }))}
        />
      )}
    </div>
  );
}

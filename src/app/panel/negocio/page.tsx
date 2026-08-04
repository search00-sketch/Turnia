import { requireBusinessUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import BusinessProfileForm from "@/components/business-profile-form";

export const dynamic = "force-dynamic";

export default async function NegocioPage() {
  const user = await requireBusinessUser();
  const businessId = user!.business!.id;

  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });

  return <BusinessProfileForm business={business} />;
}

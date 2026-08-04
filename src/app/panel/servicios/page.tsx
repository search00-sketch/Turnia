import { requireBusinessUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import ServicesManager from "@/components/services-manager";

export const dynamic = "force-dynamic";

export default async function ServiciosPage() {
  const user = await requireBusinessUser();
  const businessId = user!.business!.id;

  const services = await prisma.service.findMany({
    where: { businessId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return <ServicesManager services={services} />;
}

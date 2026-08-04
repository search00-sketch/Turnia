import { requireBusinessUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import ProfessionalsManager from "@/components/professionals-manager";

export const dynamic = "force-dynamic";

export default async function ProfesionalesPage() {
  const user = await requireBusinessUser();
  const businessId = user!.business!.id;

  const professionals = await prisma.professional.findMany({
    where: { businessId },
    orderBy: { name: "asc" },
  });

  return <ProfessionalsManager professionals={professionals} />;
}

import { requireBusinessUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import HoursManager from "@/components/hours-manager";

export const dynamic = "force-dynamic";

export default async function HorariosPage() {
  const user = await requireBusinessUser();
  const businessId = user!.business!.id;

  const hours = await prisma.businessHour.findMany({
    where: { businessId },
    orderBy: { dayOfWeek: "asc" },
  });

  return <HoursManager hours={hours} />;
}

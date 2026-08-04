import { requireBusinessUser } from "@/lib/session";
import { getHoursByBusiness } from "@/lib/db/hours";
import HoursManager from "@/components/hours-manager";

export const dynamic = "force-dynamic";

export default async function HorariosPage() {
  const user = await requireBusinessUser();
  const hours = await getHoursByBusiness(user!.business!.id);
  return <HoursManager hours={hours} />;
}

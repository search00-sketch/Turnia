import { requireBusinessUser } from "@/lib/session";
import { getServicesByBusiness } from "@/lib/db/services";
import ServicesManager from "@/components/services-manager";

export const dynamic = "force-dynamic";

export default async function ServiciosPage() {
  const user = await requireBusinessUser();
  const services = await getServicesByBusiness(user!.business!.id);
  return <ServicesManager services={services} />;
}

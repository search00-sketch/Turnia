import { requireBusinessUser } from "@/lib/session";
import { getProfessionalsByBusiness } from "@/lib/db/professionals";
import ProfessionalsManager from "@/components/professionals-manager";

export const dynamic = "force-dynamic";

export default async function ProfesionalesPage() {
  const user = await requireBusinessUser();
  const professionals = await getProfessionalsByBusiness(user!.business!.id);
  return <ProfessionalsManager professionals={professionals} />;
}

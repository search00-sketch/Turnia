import { requireBusinessUser } from "@/lib/session";
import BusinessProfileForm from "@/components/business-profile-form";

export const dynamic = "force-dynamic";

export default async function NegocioPage() {
  const user = await requireBusinessUser();
  return <BusinessProfileForm business={user!.business!} />;
}

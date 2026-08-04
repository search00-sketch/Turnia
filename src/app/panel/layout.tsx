import { redirect } from "next/navigation";
import { requireBusinessUser } from "@/lib/session";
import PanelNav from "@/components/panel-nav";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireBusinessUser();
  if (!user) redirect("/login?callbackUrl=/panel");

  return (
    <div className="section py-8">
      <div className="mb-6">
        <p className="text-sm text-neutral-400">Panel del negocio</p>
        <h1 className="text-2xl font-bold text-neutral-900">{user.business!.name}</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
        <PanelNav />
        <div>{children}</div>
      </div>
    </div>
  );
}

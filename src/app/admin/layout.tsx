import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminUser();
  if (!user) redirect("/login?callbackUrl=/admin");

  return (
    <div className="section py-8">
      <div className="mb-6">
        <p className="text-sm text-neutral-400">Panel de administración</p>
        <h1 className="text-2xl font-bold text-neutral-900">Turnia</h1>
      </div>
      {children}
    </div>
  );
}

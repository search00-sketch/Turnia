import Link from "next/link";
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
      <div className="flex gap-4 mb-6 text-sm font-medium">
        <Link href="/admin" className="text-neutral-600 hover:text-brand-600">
          Resumen
        </Link>
        <Link href="/admin/negocios" className="text-neutral-600 hover:text-brand-600">
          Negocios
        </Link>
        <Link href="/admin/zona-horaria" className="text-neutral-600 hover:text-brand-600">
          Zona horaria
        </Link>
      </div>
      {children}
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import RegistroNegocioForm from "./registro-negocio-form";
import AddBusinessForm from "@/components/add-business-form";

export const dynamic = "force-dynamic";

export default async function RegistroNegocioPage() {
  const user = await getCurrentUser();

  // Ya tiene negocio: directo a su panel.
  if (user?.business) redirect("/panel");

  // Cliente con sesión iniciada: suma el negocio a su misma cuenta.
  if (user?.role === "CLIENTE") {
    return <AddBusinessForm user={{ name: user.name, email: user.email, phone: user.phone }} />;
  }

  if (user?.role === "ADMIN") {
    return (
      <div className="section max-w-md py-16">
        <div className="card p-8 text-center space-y-3">
          <h1 className="text-xl font-extrabold text-plum-900">Esta es una cuenta de administrador</h1>
          <p className="text-sm text-plum-500">
            Para publicar un negocio, cerrá sesión y registralo con otra cuenta.
          </p>
          <Link href="/admin" className="btn-secondary">Volver al admin</Link>
        </div>
      </div>
    );
  }

  return <RegistroNegocioForm />;
}

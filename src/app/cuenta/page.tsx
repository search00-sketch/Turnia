import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import SignOutButton from "@/components/sign-out-button";
import EmailToggle from "@/components/email-toggle";
import { Sketch } from "@/components/sketch";
import { IconCalendar, IconChevron, IconGrid } from "@/components/icons";

export const dynamic = "force-dynamic";

const ROLE_LABEL = { CLIENTE: "Cliente", NEGOCIO: "Negocio y cliente", ADMIN: "Administrador" } as const;

export default async function CuentaPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="section max-w-md py-12">
        <div className="card p-8 text-center space-y-5">
          <Sketch name="sparkle" className="mx-auto h-14 w-14 text-plum-400" />
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-plum-900">Tu cuenta</h1>
            <p className="text-sm text-plum-500">Ingresá para reservar y ver tus turnos.</p>
          </div>
          <div className="grid gap-3">
            <Link href="/login" className="btn-primary w-full">Ingresar</Link>
            <Link href="/registro" className="btn-secondary w-full">Crear cuenta</Link>
          </div>
          <Link href="/publica-tu-negocio" className="block text-sm font-semibold text-brand-600">
            ¿Tenés un negocio? Publicalo gratis
          </Link>
        </div>
      </div>
    );
  }

  const links =
    user.role === "NEGOCIO"
      ? [
          { href: "/panel", label: "Panel de mi negocio", Icon: IconGrid },
          { href: "/mis-turnos", label: "Mis turnos (como cliente)", Icon: IconCalendar },
        ]
      : user.role === "ADMIN"
      ? [{ href: "/admin", label: "Panel de administración", Icon: IconGrid }]
      : [{ href: "/mis-turnos", label: "Mis turnos", Icon: IconCalendar }];

  return (
    <div className="section max-w-md py-10 space-y-5">
      <div className="plum-surface rounded-xl2 p-6 relative overflow-hidden">
        <Sketch name="leaf" className="absolute -right-3 -bottom-4 h-28 w-28 text-brand-300 opacity-40" />
        <p className="text-xs font-bold uppercase tracking-wider text-brand-200">{ROLE_LABEL[user.role]}</p>
        <h1 className="text-2xl font-extrabold mt-1">
          {user.name} {user.lastName ?? ""}
        </h1>
        <p className="text-sm text-plum-200 mt-1 break-all">{user.email}</p>
      </div>

      <div className="card divide-y divide-plum-100">
        {links.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-5 py-4 font-semibold text-plum-900">
            <Icon className="h-5 w-5 text-brand-600" />
            <span className="flex-1">{label}</span>
            <IconChevron className="h-4 w-4 text-plum-300" />
          </Link>
        ))}
        {user.role === "CLIENTE" && (
          <Link href="/registro-negocio" className="flex items-center gap-3 px-5 py-4 font-semibold text-plum-900">
            <Sketch name="scissors" className="h-5 w-5 text-brand-600" />
            <span className="flex-1">
              <span className="block">Sumá tu negocio a esta cuenta</span>
              <span className="block text-xs font-normal text-plum-500">Seguís pudiendo reservar como cliente</span>
            </span>
            <IconChevron className="h-4 w-4 text-plum-300" />
          </Link>
        )}
      </div>

      <div className="card">
        <EmailToggle optOut={user.emailOptOut} />
      </div>

      <SignOutButton className="btn-secondary w-full" />
    </div>
  );
}

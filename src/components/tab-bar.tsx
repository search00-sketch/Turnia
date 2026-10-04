"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCalendar, IconGrid, IconHome, IconSearch, IconUser } from "@/components/icons";

type Role = "CLIENTE" | "NEGOCIO" | "ADMIN" | null;

/** Pantallas con su propia barra de abajo (reservar) o su propio menú (panel, admin). */
function hiddenOn(pathname: string) {
  return (
    pathname.startsWith("/panel") ||
    pathname.startsWith("/admin") ||
    /^\/negocios\/[^/]+(\/reservar)?$/.test(pathname)
  );
}

/** Barra de pestañas fija abajo, sólo en celular. */
export default function TabBar({ role }: { role: Role }) {
  const pathname = usePathname();
  if (hiddenOn(pathname)) return null;

  const third =
    role === "NEGOCIO"
      ? { href: "/panel", label: "Mi panel", Icon: IconGrid }
      : role === "ADMIN"
      ? { href: "/admin", label: "Admin", Icon: IconGrid }
      : { href: "/mis-turnos", label: "Mis turnos", Icon: IconCalendar };

  const tabs = [
    { href: "/", label: "Inicio", Icon: IconHome, exact: true, prefetch: true },
    { href: "/negocios", label: "Buscar", Icon: IconSearch, exact: false, prefetch: true },
    // Dependen de la sesión: sin precarga, para no guardar una versión de "sin sesión".
    { ...third, exact: false, prefetch: false },
    { href: "/cuenta", label: "Cuenta", Icon: IconUser, exact: false, prefetch: false },
  ];

  return (
    <>
      {/* reserva el espacio de la barra para que no tape el final de la página */}
      <div className="h-20 md:hidden" aria-hidden="true" />
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-plum-100 bg-white/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="Navegación principal"
      >
        <ul className="grid grid-cols-4">
          {tabs.map(({ href, label, Icon, exact, prefetch }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  prefetch={prefetch ? undefined : false}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 pt-1.5 pb-2.5 text-[11px] font-bold ${
                    active ? "text-plum-900" : "text-plum-400"
                  }`}
                >
                  <span className={`h-[3px] w-5 rounded-full ${active ? "bg-brand-600" : "bg-transparent"}`} />
                  <Icon className={`h-[22px] w-[22px] ${active ? "text-brand-600" : ""}`} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

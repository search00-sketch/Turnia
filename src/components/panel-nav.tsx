"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/panel", label: "Resumen", exact: true },
  { href: "/panel/agenda", label: "Agenda" },
  { href: "/panel/servicios", label: "Servicios" },
  { href: "/panel/profesionales", label: "Profesionales" },
  { href: "/panel/horarios", label: "Horarios" },
  { href: "/panel/contabilidad", label: "Contabilidad" },
  { href: "/panel/negocio", label: "Mi negocio" },
];

export default function PanelNav() {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  // En celular el menú se desplaza de costado: que la sección actual quede a la vista.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  return (
    <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
      {LINKS.map((link) => {
        const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            ref={active ? activeRef : undefined}
            className={`shrink-0 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
              active ? "bg-brand-600 text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

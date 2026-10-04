"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** "Ingresar" que, después de iniciar sesión, vuelve a la página donde estaba la persona. */
export default function LoginLink({ className, children = "Ingresar" }: { className?: string; children?: React.ReactNode }) {
  const pathname = usePathname();
  const skip = pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/registro") || pathname === "/cuenta";
  const query = typeof window !== "undefined" ? window.location.search : "";
  const href = skip ? "/login" : `/login?callbackUrl=${encodeURIComponent(pathname + query)}`;
  return (
    <Link href={href} className={className} prefetch={false}>
      {children}
    </Link>
  );
}

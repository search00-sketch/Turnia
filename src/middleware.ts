import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/session-constants";

// El middleware corre en el runtime Edge, donde el SDK de administración de
// Firebase no funciona. Acá sólo hacemos una verificación rápida ("¿hay
// cookie de sesión?") para redirigir sin renderizar nada. La verificación real
// del token y el chequeo de rol pasa en el layout/página (runtime de Node),
// vía getCurrentUser().
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!hasSession && (pathname.startsWith("/panel") || pathname.startsWith("/mis-turnos"))) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/panel/:path*", "/mis-turnos/:path*"],
};

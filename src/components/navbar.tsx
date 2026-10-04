import Link from "next/link";
import Logo from "@/components/logo";
import SignOutButton from "@/components/sign-out-button";

interface NavUser {
  name: string;
  role: "CLIENTE" | "NEGOCIO" | "ADMIN";
  businessSlug: string | null;
}

// En compu: menú completo arriba. En celular: sólo el logo (y "Ingresar");
// la navegación va en la barra de pestañas de abajo (<TabBar />).
export default function Navbar({ user }: { user: NavUser | null }) {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-plum-100">
      <div className="section flex h-14 md:h-16 items-center justify-between">
        <Link href="/" className="shrink-0" aria-label="Inicio">
          <Logo />
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-plum-700">
          <Link href="/negocios" className="hover:text-brand-600">
            Explorar negocios
          </Link>
          {user?.role !== "NEGOCIO" && (
            <Link href="/publica-tu-negocio" className="hover:text-brand-600">
              Publicá tu negocio
            </Link>
          )}
          {user?.role === "CLIENTE" && (
            <Link href="/mis-turnos" className="hover:text-brand-600">
              Mis turnos
            </Link>
          )}
          {user?.role === "NEGOCIO" && (
            <Link href="/panel" className="hover:text-brand-600">
              Panel del negocio
            </Link>
          )}
          {user?.role === "ADMIN" && (
            <Link href="/admin" className="hover:text-brand-600">
              Admin
            </Link>
          )}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {!user ? (
            <>
              <Link href="/login" className="btn-ghost">
                Ingresar
              </Link>
              <Link href="/registro" className="btn-primary">
                Registrarse
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-plum-500">Hola, {user.name.split(" ")[0]}</span>
              <SignOutButton />
            </div>
          )}
        </div>

        {!user && (
          <Link href="/login" className="md:hidden text-sm font-bold text-plum-900">
            Ingresar
          </Link>
        )}
      </div>
    </header>
  );
}

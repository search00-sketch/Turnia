"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut as firebaseSignOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { clearSessionCookie } from "@/actions/session";
import { APP_NAME } from "@/lib/config";

interface NavUser {
  name: string;
  role: "CLIENTE" | "NEGOCIO" | "ADMIN";
  businessSlug: string | null;
}

export default function Navbar({ user }: { user: NavUser | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await firebaseSignOut(getFirebaseAuth());
    } catch {
      // si falla el signOut del cliente igual limpiamos la cookie del servidor
    }
    await clearSessionCookie();
    setSigningOut(false);
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-neutral-100">
      <div className="section flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl font-extrabold tracking-tight text-brand-600">
            {APP_NAME}
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-700">
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
              <span className="text-sm text-neutral-600">
                Hola, {user.name.split(" ")[0]}
              </span>
              <button onClick={handleSignOut} disabled={signingOut} className="btn-ghost">
                {signingOut ? "Saliendo..." : "Cerrar sesión"}
              </button>
            </div>
          )}
        </div>

        <button
          className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-neutral-600 hover:bg-neutral-100"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menú"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
            ) : (
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-neutral-100 bg-white">
          <div className="section flex flex-col gap-1 py-3 text-sm font-medium text-neutral-700">
            <Link href="/negocios" className="py-2" onClick={() => setOpen(false)}>
              Explorar negocios
            </Link>
            {user?.role !== "NEGOCIO" && (
              <Link href="/publica-tu-negocio" className="py-2" onClick={() => setOpen(false)}>
                Publicá tu negocio
              </Link>
            )}
            {user?.role === "CLIENTE" && (
              <Link href="/mis-turnos" className="py-2" onClick={() => setOpen(false)}>
                Mis turnos
              </Link>
            )}
            {user?.role === "NEGOCIO" && (
              <Link href="/panel" className="py-2" onClick={() => setOpen(false)}>
                Panel del negocio
              </Link>
            )}
            <div className="h-px bg-neutral-100 my-2" />
            {!user ? (
              <>
                <Link href="/login" className="py-2" onClick={() => setOpen(false)}>
                  Ingresar
                </Link>
                <Link href="/registro" className="py-2" onClick={() => setOpen(false)}>
                  Registrarse
                </Link>
              </>
            ) : (
              <button className="py-2 text-left" onClick={handleSignOut} disabled={signingOut}>
                {signingOut ? "Saliendo..." : "Cerrar sesión"}
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

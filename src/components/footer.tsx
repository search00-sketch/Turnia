import Link from "next/link";
import Logo from "@/components/logo";
import { APP_NAME, CATEGORIES } from "@/lib/config";

export default function Footer() {
  return (
    <footer className="mt-16 md:mt-24 border-t border-plum-100 bg-white/70">
      <div className="section py-8 md:py-10 grid md:grid-cols-4 gap-6 md:gap-8 text-sm">
        <div className="md:col-span-1">
          <Logo className="text-xl" />
          <p className="mt-2 text-plum-500">Reservá turnos online en los negocios de belleza y bienestar de tu zona.</p>
        </div>
        {/* En celular la navegación está en la barra de abajo: el footer queda corto. */}
        <div className="hidden md:block">
          <h4 className="font-bold text-plum-900 mb-3">La plataforma</h4>
          <ul className="space-y-2 text-plum-500">
            <li><Link href="/negocios" className="hover:text-brand-600">Explorar negocios</Link></li>
            <li><Link href="/publica-tu-negocio" className="hover:text-brand-600">Publicá tu negocio</Link></li>
          </ul>
        </div>
        <div className="hidden md:block">
          <h4 className="font-bold text-plum-900 mb-3">Cuenta</h4>
          <ul className="space-y-2 text-plum-500">
            <li><Link href="/login" className="hover:text-brand-600">Ingresar</Link></li>
            <li><Link href="/registro" className="hover:text-brand-600">Registrarse</Link></li>
            <li><Link href="/mis-turnos" className="hover:text-brand-600">Mis turnos</Link></li>
          </ul>
        </div>
        <div className="hidden md:block">
          <h4 className="font-bold text-plum-900 mb-3">Categorías</h4>
          <ul className="space-y-2 text-plum-500">
            {CATEGORIES.filter((c) => c.slug !== "otros").slice(0, 4).map((c) => (
              <li key={c.slug}><Link href={`/negocios?categoria=${c.slug}`} className="hover:text-brand-600">{c.label}</Link></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-plum-100 py-4 text-center text-xs text-plum-400">
        © {new Date().getFullYear()} {APP_NAME} · <Link href="/publica-tu-negocio" className="hover:text-brand-600">¿Tenés un negocio?</Link>
      </div>
    </footer>
  );
}

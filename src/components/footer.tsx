import Link from "next/link";
import { APP_NAME } from "@/lib/config";

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-neutral-100 bg-white">
      <div className="section py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div className="col-span-2 md:col-span-1">
          <span className="text-xl font-extrabold text-brand-600">{APP_NAME}</span>
          <p className="mt-2 text-neutral-500">
            Reservá turnos online en los negocios de belleza y bienestar de tu zona.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-neutral-800 mb-3">La plataforma</h4>
          <ul className="space-y-2 text-neutral-500">
            <li><Link href="/negocios" className="hover:text-brand-600">Explorar negocios</Link></li>
            <li><Link href="/publica-tu-negocio" className="hover:text-brand-600">Publicá tu negocio</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-neutral-800 mb-3">Cuenta</h4>
          <ul className="space-y-2 text-neutral-500">
            <li><Link href="/login" className="hover:text-brand-600">Ingresar</Link></li>
            <li><Link href="/registro" className="hover:text-brand-600">Registrarse</Link></li>
            <li><Link href="/mis-turnos" className="hover:text-brand-600">Mis turnos</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-neutral-800 mb-3">Categorías</h4>
          <ul className="space-y-2 text-neutral-500">
            <li><Link href="/negocios?categoria=peluqueria" className="hover:text-brand-600">Peluquería</Link></li>
            <li><Link href="/negocios?categoria=barberia" className="hover:text-brand-600">Barbería</Link></li>
            <li><Link href="/negocios?categoria=spa" className="hover:text-brand-600">Spa</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-neutral-100 py-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} {APP_NAME}. Proyecto de reservas de turnos.
      </div>
    </footer>
  );
}

import Link from "next/link";
import { APP_NAME } from "@/lib/config";

const FEATURES = [
  {
    title: "Agenda online 24hs",
    text: "Tus clientes reservan cuando quieren, incluso con el negocio cerrado, sin llamadas ni mensajes de ida y vuelta.",
  },
  {
    title: "Panel para gestionar todo",
    text: "Cargá tus servicios, profesionales y horarios, y mirá los turnos del día desde cualquier dispositivo.",
  },
  {
    title: "Recordatorios automáticos",
    text: "Reducí las ausencias: cada cliente recibe un email de confirmación y un recordatorio antes de su turno.",
  },
  {
    title: "Profesionales ilimitados",
    text: "Sumá a todo tu equipo sin costo adicional y organizá la agenda de cada uno por separado.",
  },
];

export default function PublicaTuNegocioPage() {
  return (
    <div>
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="section py-16 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900">
            Publicá tu negocio en {APP_NAME}
          </h1>
          <p className="mt-4 text-neutral-500 max-w-xl mx-auto">
            Creá tu cuenta gratis, cargá tus servicios y empezá a recibir reservas online hoy mismo.
          </p>
          <Link href="/registro-negocio" className="btn-primary mt-8 inline-flex">
            Crear mi negocio
          </Link>
        </div>
      </section>

      <section className="section py-12 grid grid-cols-1 sm:grid-cols-2 gap-6">
        {FEATURES.map((f) => (
          <div key={f.title} className="card p-6">
            <h3 className="font-semibold text-neutral-900 mb-1.5">{f.title}</h3>
            <p className="text-sm text-neutral-500">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="section pb-16 text-center">
        <div className="card p-10 bg-brand-600 text-white rounded-xl2">
          <h2 className="text-xl font-bold">¿Listo para empezar?</h2>
          <p className="mt-2 text-brand-50">Registrate en dos minutos, sin tarjeta de crédito.</p>
          <Link href="/registro-negocio" className="btn-secondary mt-6 inline-flex bg-white">
            Publicá tu negocio
          </Link>
        </div>
      </section>
    </div>
  );
}

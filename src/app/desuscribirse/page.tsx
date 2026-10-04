import Link from "next/link";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { Sketch } from "@/components/sketch";
import UnsubscribeButton from "@/components/unsubscribe-button";

export const dynamic = "force-dynamic";

// El link del pie de los mails trae a esta página. Se confirma con un botón
// (y no al abrir el link) para que los programas de correo que revisan los
// links automáticamente no desuscriban a nadie sin querer.
export default function DesuscribirsePage({ searchParams }: { searchParams: { t?: string } }) {
  const valid = Boolean(verifyUnsubscribeToken(searchParams.t));
  return (
    <div className="section max-w-md py-12">
      <div className="card p-8 text-center space-y-4">
        <Sketch name="sparkle" className="mx-auto h-14 w-14 text-plum-400" />
        <h1 className="text-2xl font-extrabold text-plum-900">Mails de Turnia</h1>
        {valid ? (
          <>
            <p className="text-sm text-plum-600">
              Si confirmás, no te vamos a mandar más mails: ni confirmaciones de turnos, ni recordatorios, ni avisos de
              cancelación. Tus turnos los vas a seguir viendo en la app.
            </p>
            <UnsubscribeButton token={searchParams.t!} />
          </>
        ) : (
          <p className="text-sm text-plum-600">
            El link no es válido o está incompleto. Podés elegir si recibir mails desde{" "}
            <Link href="/cuenta" className="font-bold text-brand-600">tu cuenta</Link>.
          </p>
        )}
      </div>
    </div>
  );
}

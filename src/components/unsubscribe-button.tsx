"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { unsubscribeWithToken } from "@/actions/email-preferences";

export default function UnsubscribeButton({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <div className="space-y-2">
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Listo, no vas a recibir más mails de Turnia.
        </p>
        <p className="text-xs text-plum-500">
          Si cambiás de idea, podés volver a activarlos desde <Link href="/cuenta" className="font-bold text-brand-600">tu cuenta</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        className="btn-primary w-full"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const res = await unsubscribeWithToken(token);
            if (res.ok) setDone(true);
            else setError(res.error);
          })
        }
      >
        {isPending ? "Guardando..." : "Dejar de recibir mails"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

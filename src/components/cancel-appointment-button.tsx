"use client";

import { useState, useTransition } from "react";
import { cancelAppointmentAsClient } from "@/actions/bookings";

export default function CancelAppointmentButton({ appointmentId }: { appointmentId: string }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return <span className="text-sm text-neutral-400">Turno cancelado</span>;
  }

  return (
    <div className="text-right">
      <button
        onClick={() => {
          if (!confirm("¿Seguro que querés cancelar este turno?")) return;
          startTransition(async () => {
            const res = await cancelAppointmentAsClient(appointmentId);
            if (res.ok) setDone(true);
            else setError(res.error);
          });
        }}
        disabled={isPending}
        className="text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
      >
        {isPending ? "Cancelando..." : "Cancelar turno"}
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

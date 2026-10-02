"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAppointmentStatusAsBusiness } from "@/actions/bookings";

export default function AppointmentStatusActions({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: "PENDIENTE" | "CONFIRMADO" | "CANCELADO" | "COMPLETADO";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(next: "CONFIRMADO" | "CANCELADO" | "COMPLETADO") {
    setError(null);
    startTransition(async () => {
      const res = await updateAppointmentStatusAsBusiness(appointmentId, next);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const errorMessage = error && <p className="text-xs text-red-600 mt-1 max-w-[220px] text-right">{error}</p>;

  if (status === "CANCELADO") {
    return (
      <div className="shrink-0 text-right">
        <button
          onClick={() => update("CONFIRMADO")}
          disabled={isPending}
          className="text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50"
        >
          {isPending ? "Reactivando..." : "Reactivar"}
        </button>
        {errorMessage}
      </div>
    );
  }

  if (status === "COMPLETADO") {
    return <span className="text-xs text-neutral-400">Completado</span>;
  }

  return (
    <div className="shrink-0 text-right">
      <div className="flex gap-3 justify-end">
        <button
          onClick={() => update("COMPLETADO")}
          disabled={isPending}
          className="text-xs font-semibold text-green-700 hover:text-green-800 disabled:opacity-50"
        >
          Marcar realizado
        </button>
        <button
          onClick={() => update("CANCELADO")}
          disabled={isPending}
          className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
      {errorMessage}
    </div>
  );
}

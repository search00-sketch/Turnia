"use client";

import { useTransition } from "react";
import { updateAppointmentStatusAsBusiness } from "@/actions/bookings";

export default function AppointmentStatusActions({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: "PENDIENTE" | "CONFIRMADO" | "CANCELADO" | "COMPLETADO";
}) {
  const [isPending, startTransition] = useTransition();

  function update(next: "CONFIRMADO" | "CANCELADO" | "COMPLETADO") {
    startTransition(() => {
      updateAppointmentStatusAsBusiness(appointmentId, next);
    });
  }

  if (status === "CANCELADO") {
    return (
      <button
        onClick={() => update("CONFIRMADO")}
        disabled={isPending}
        className="text-xs font-semibold text-brand-600 hover:text-brand-700"
      >
        Reactivar
      </button>
    );
  }

  if (status === "COMPLETADO") {
    return <span className="text-xs text-neutral-400">Completado</span>;
  }

  return (
    <div className="flex gap-3 shrink-0">
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
  );
}

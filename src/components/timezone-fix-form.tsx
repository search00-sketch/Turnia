"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminApplyTimezoneFix } from "@/actions/admin";

interface AppointmentRow {
  id: string;
  businessName: string;
  status: string;
  label: "CORREGIR" | "AMBIGUO" | "OK" | "SIN DATOS";
  current: string;
  fixed: string;
}

interface PaidUntilRow {
  businessId: string;
  businessName: string;
  current: string;
  fixed: string;
}

const LABEL_STYLE: Record<AppointmentRow["label"], string> = {
  CORREGIR: "bg-amber-100 text-amber-800",
  AMBIGUO: "bg-blue-100 text-blue-700",
  OK: "bg-green-100 text-green-700",
  "SIN DATOS": "bg-neutral-100 text-neutral-600",
};

const LABEL_TEXT: Record<AppointmentRow["label"], string> = {
  CORREGIR: "Corregir",
  AMBIGUO: "Ambiguo",
  OK: "OK",
  "SIN DATOS": "Sin datos",
};

export default function TimezoneFixForm({
  appointments,
  paidUntil,
}: {
  appointments: AppointmentRow[];
  paidUntil: PaidUntilRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(appointments.filter((a) => a.label === "CORREGIR").map((a) => a.id))
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function apply() {
    const total = selected.size + paidUntil.length;
    if (!window.confirm(`¿Corregir ${selected.size} turnos y ${paidUntil.length} fechas "pagado hasta"? (${total} cambios)`)) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await adminApplyTimezoneFix(Array.from(selected));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(`Listo: se corrigieron ${res.appointments} turnos y ${res.paidUntil} fechas "pagado hasta".`);
      router.refresh();
    });
  }

  if (appointments.length === 0 && paidUntil.length === 0) {
    return (
      <div className="card p-6 text-sm text-green-700 bg-green-50 border-green-100">
        {message ?? "No hay nada para corregir: todos los turnos y fechas están bien."}
      </div>
    );
  }

  return (
    <div className="card p-6 space-y-4">
      {message && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{message}</p>}
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {appointments.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500 border-b border-neutral-100">
                <th className="py-2 pr-3 font-medium"></th>
                <th className="py-2 pr-4 font-medium">Tipo</th>
                <th className="py-2 pr-4 font-medium">Negocio</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 pr-4 font-medium">Hoy figura</th>
                <th className="py-2 font-medium">Corregido</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id} className="border-b border-neutral-50 last:border-0">
                  <td className="py-2 pr-3">
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggle(a.id)}
                      aria-label={`Corregir turno de ${a.businessName} del ${a.current}`}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${LABEL_STYLE[a.label]}`}>
                      {LABEL_TEXT[a.label]}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-neutral-900">{a.businessName}</td>
                  <td className="py-2 pr-4 text-neutral-500 capitalize">{a.status.toLowerCase()}</td>
                  <td className="py-2 pr-4 text-neutral-500 whitespace-nowrap">{a.current}</td>
                  <td className="py-2 text-neutral-900 whitespace-nowrap">{a.fixed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paidUntil.length > 0 && (
        <div className="text-sm">
          <p className="font-medium text-neutral-900 mb-1">Fechas &quot;pagado hasta&quot; (se corrigen todas)</p>
          <ul className="text-neutral-600 space-y-0.5">
            {paidUntil.map((p) => (
              <li key={p.businessId}>
                {p.businessName}: {p.current} → {p.fixed}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button onClick={apply} disabled={isPending || (selected.size === 0 && paidUntil.length === 0)} className="btn-primary">
        {isPending ? "Corrigiendo..." : `Aplicar corrección (${selected.size} turnos${paidUntil.length ? ` + ${paidUntil.length} fechas` : ""})`}
      </button>
    </div>
  );
}

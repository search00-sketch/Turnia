"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMovement, deleteMovement } from "@/actions/accounting";
import { formatPrice } from "@/lib/format";

interface MovementItem {
  id: string;
  type: "INGRESO" | "GASTO";
  dateISO: string;
  amount: number;
  concept: string;
  serviceName: string | null;
  notes: string | null;
}

interface ServiceOption {
  id: string;
  name: string;
  active: boolean;
}

function formatDateISO(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function MovementsManager({
  movements,
  services,
  defaultDate,
}: {
  movements: MovementItem[];
  services: ServiceOption[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const emptyForm = { type: "GASTO" as "INGRESO" | "GASTO", date: defaultDate, amount: "", concept: "", serviceId: "", notes: "" };
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const concepts = Array.from(new Set(movements.map((m) => m.concept)));
  const activeServices = services.filter((s) => s.active);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createMovement(form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setForm({ ...emptyForm, type: form.type, date: form.date });
      setShowForm(false);
      router.refresh();
    });
  }

  function remove(m: MovementItem) {
    if (!window.confirm(`¿Borrar "${m.concept}" por ${formatPrice(m.amount)}?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteMovement(m.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-neutral-900">Gastos e ingresos cargados</h2>
          <p className="text-sm text-neutral-500">
            Compras de insumos, alquiler, sueldos, venta de productos... Imputalos a un servicio o agrupalos por concepto.
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancelar" : "+ Cargar movimiento"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {showForm && (
        <form onSubmit={submit} className="rounded-lg border border-neutral-100 bg-neutral-50 p-4 space-y-3">
          <div className="flex gap-2">
            {(["GASTO", "INGRESO"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t }))}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold border ${
                  form.type === t
                    ? t === "GASTO"
                      ? "bg-red-600 border-red-600 text-white"
                      : "bg-green-600 border-green-600 text-white"
                    : "bg-white border-neutral-200 text-neutral-600"
                }`}
              >
                {t === "GASTO" ? "Gasto" : "Ingreso"}
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Fecha</label>
              <input
                type="date"
                className="input"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Monto (ARS)</label>
              <input
                type="number"
                min={0}
                step="any"
                className="input"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Servicio (opcional)</label>
              <select
                className="input"
                value={form.serviceId}
                onChange={(e) => setForm((f) => ({ ...f, serviceId: e.target.value }))}
              >
                <option value="">— Ninguno / otro concepto —</option>
                {activeServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Concepto</label>
              <input
                list="conceptos"
                className="input"
                value={form.concept}
                onChange={(e) => setForm((f) => ({ ...f, concept: e.target.value }))}
                placeholder={form.type === "GASTO" ? "Ej: Tintura, Alquiler, Sueldos..." : "Ej: Venta shampoo"}
                required
              />
              <datalist id="conceptos">
                {concepts.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {!form.serviceId && (
                <p className="text-xs text-neutral-400 mt-1">
                  Sin servicio elegido, se agrupa por concepto (ej: todo lo de &quot;Shampoo&quot; en una sola fila).
                </p>
              )}
            </div>
            <div>
              <label className="label">Nota (opcional)</label>
              <input
                className="input"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <button disabled={isPending} className="btn-primary">
            {isPending ? "Guardando..." : `Guardar ${form.type === "GASTO" ? "gasto" : "ingreso"}`}
          </button>
        </form>
      )}

      {movements.length === 0 ? (
        <p className="text-sm text-neutral-500">No hay movimientos cargados este mes.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {movements.map((m) => (
            <li key={m.id} className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-neutral-900">
                  {m.concept}
                  {m.serviceName && <span className="text-sm font-normal text-neutral-500"> · {m.serviceName}</span>}
                </p>
                <p className="text-sm text-neutral-500">
                  {formatDateISO(m.dateISO)}
                  {m.notes ? ` · ${m.notes}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className={`text-sm font-semibold ${m.type === "GASTO" ? "text-red-600" : "text-green-700"}`}>
                  {m.type === "GASTO" ? "−" : "+"}
                  {formatPrice(m.amount)}
                </span>
                <button
                  onClick={() => remove(m)}
                  disabled={isPending}
                  className="text-xs font-semibold text-neutral-400 hover:text-red-600 disabled:opacity-50"
                >
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

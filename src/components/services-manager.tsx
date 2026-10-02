"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createService, updateService, setServiceActive } from "@/actions/services";
import { formatDuration, formatPrice } from "@/lib/format";

interface ServiceItem {
  id: string;
  category: string;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  durationMin: number;
  active: boolean;
}

const emptyForm = { category: "", name: "", description: "", price: "", cost: "", durationMin: "30" };

export default function ServicesManager({ services }: { services: ServiceItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showNew, setShowNew] = useState(services.length === 0);
  const [newForm, setNewForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const categories = Array.from(new Set(services.map((s) => s.category)));

  function startEdit(s: ServiceItem) {
    setEditingId(s.id);
    setEditForm({
      category: s.category,
      name: s.name,
      description: s.description ?? "",
      price: String(s.price),
      cost: s.cost ? String(s.cost) : "",
      durationMin: String(s.durationMin),
    });
  }

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createService(newForm);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNewForm(emptyForm);
      setShowNew(false);
      router.refresh();
    });
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError(null);
    startTransition(async () => {
      const res = await updateService(editingId, editForm);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function toggleActive(s: ServiceItem) {
    startTransition(async () => {
      await setServiceActive(s.id, !s.active);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-neutral-900">Servicios</h2>
        <button className="btn-primary" onClick={() => setShowNew((v) => !v)}>
          {showNew ? "Cancelar" : "+ Nuevo servicio"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {showNew && (
        <form onSubmit={submitNew} className="card p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Categoría</label>
              <input
                list="categorias"
                className="input"
                value={newForm.category}
                onChange={(e) => setNewForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Ej: Corte, Color, Uñas..."
                required
              />
              <datalist id="categorias">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label">Nombre del servicio</label>
              <input
                className="input"
                value={newForm.name}
                onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Descripción (opcional)</label>
            <textarea
              className="input"
              rows={2}
              value={newForm.description}
              onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Precio (ARS)</label>
              <input
                type="number"
                min={0}
                className="input"
                value={newForm.price}
                onChange={(e) => setNewForm((f) => ({ ...f, price: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Costo por turno (ARS)</label>
              <input
                type="number"
                min={0}
                className="input"
                value={newForm.cost}
                onChange={(e) => setNewForm((f) => ({ ...f, cost: e.target.value }))}
                placeholder="Insumos, comisión..."
              />
            </div>
            <div>
              <label className="label">Duración (minutos)</label>
              <input
                type="number"
                min={5}
                step={5}
                className="input"
                value={newForm.durationMin}
                onChange={(e) => setNewForm((f) => ({ ...f, durationMin: e.target.value }))}
                required
              />
            </div>
          </div>
          <button disabled={isPending} className="btn-primary">
            {isPending ? "Guardando..." : "Guardar servicio"}
          </button>
        </form>
      )}

      {services.length === 0 && !showNew && (
        <p className="text-sm text-neutral-500">Todavía no cargaste servicios.</p>
      )}

      <div className="space-y-3">
        {services.map((s) => (
          <div key={s.id} className={`card p-5 ${!s.active ? "opacity-60" : ""}`}>
            {editingId === s.id ? (
              <form onSubmit={submitEdit} className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Categoría</label>
                    <input
                      className="input"
                      value={editForm.category}
                      onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Nombre</label>
                    <input
                      className="input"
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Descripción</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label">Precio (ARS)</label>
                    <input
                      type="number"
                      min={0}
                      className="input"
                      value={editForm.price}
                      onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Costo por turno (ARS)</label>
                    <input
                      type="number"
                      min={0}
                      className="input"
                      value={editForm.cost}
                      onChange={(e) => setEditForm((f) => ({ ...f, cost: e.target.value }))}
                      placeholder="Insumos, comisión..."
                    />
                  </div>
                  <div>
                    <label className="label">Duración (min)</label>
                    <input
                      type="number"
                      min={5}
                      step={5}
                      className="input"
                      value={editForm.durationMin}
                      onChange={(e) => setEditForm((f) => ({ ...f, durationMin: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button disabled={isPending} className="btn-primary">
                    Guardar
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => setEditingId(null)}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold uppercase text-brand-600">{s.category}</span>
                  <p className="font-medium text-neutral-900">
                    {s.name} {!s.active && <span className="text-xs text-neutral-400">(archivado)</span>}
                  </p>
                  {s.description && <p className="text-sm text-neutral-500">{s.description}</p>}
                  <p className="text-sm text-neutral-400">
                    {formatDuration(s.durationMin)} · {formatPrice(s.price)}
                    {s.cost > 0 && (
                      <>
                        {" "}
                        · costo {formatPrice(s.cost)} · ganancia {formatPrice(s.price - s.cost)}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex gap-3 shrink-0">
                  <button className="text-sm font-semibold text-brand-600" onClick={() => startEdit(s)}>
                    Editar
                  </button>
                  <button
                    className="text-sm font-semibold text-neutral-500"
                    onClick={() => toggleActive(s)}
                    disabled={isPending}
                  >
                    {s.active ? "Archivar" : "Reactivar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

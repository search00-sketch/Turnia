"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProfessional, updateProfessional, setProfessionalActive } from "@/actions/professionals";
import { setProfessionalPhoto } from "@/actions/images";
import ImageUploader from "@/components/image-uploader";
import Avatar from "@/components/avatar";

interface ProfessionalItem {
  id: string;
  name: string;
  photo: string | null;
  active: boolean;
}

export default function ProfessionalsManager({ professionals }: { professionals: ProfessionalItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showNew, setShowNew] = useState(professionals.length === 0);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createProfessional({ name: newName });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNewName("");
      setShowNew(false);
      router.refresh();
    });
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setError(null);
    startTransition(async () => {
      const res = await updateProfessional(editingId, { name: editName });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  function toggleActive(p: ProfessionalItem) {
    startTransition(async () => {
      await setProfessionalActive(p.id, !p.active);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-neutral-900">Profesionales</h2>
        <button className="btn-primary" onClick={() => setShowNew((v) => !v)}>
          {showNew ? "Cancelar" : "+ Nuevo profesional"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {showNew && (
        <form onSubmit={submitNew} className="card p-5 flex gap-3 items-end">
          <div className="flex-1">
            <label className="label">Nombre y apellido</label>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          </div>
          <button disabled={isPending} className="btn-primary shrink-0">
            {isPending ? "Guardando..." : "Guardar"}
          </button>
        </form>
      )}

      {professionals.length === 0 && !showNew && (
        <p className="text-sm text-neutral-500">
          Todavía no cargaste profesionales. Necesitás al menos uno para poder recibir reservas.
        </p>
      )}

      <div className="space-y-3">
        {professionals.map((p) => (
          <div key={p.id} className={`card p-5 flex items-center justify-between gap-4 ${!p.active ? "opacity-60" : ""}`}>
            {editingId === p.id ? (
              <form onSubmit={submitEdit} className="flex-1 flex gap-3 items-end">
                <div className="flex-1">
                  <label className="label">Nombre y apellido</label>
                  <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} required />
                </div>
                <button disabled={isPending} className="btn-primary shrink-0">
                  Guardar
                </button>
                <button type="button" className="btn-ghost shrink-0" onClick={() => setEditingId(null)}>
                  Cancelar
                </button>
              </form>
            ) : (
              <>
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900 mb-2">
                    {p.name} {!p.active && <span className="text-xs text-neutral-400">(archivado)</span>}
                  </p>
                  <ImageUploader
                    compact
                    currentUrl={p.photo}
                    width={320}
                    height={320}
                    maxBytes={40 * 1024}
                    onSave={(dataUrl) => setProfessionalPhoto(p.id, dataUrl)}
                    preview={(src) => <Avatar name={p.name} src={src} size={48} />}
                  />
                </div>
                <div className="flex gap-3 shrink-0">
                  <button
                    className="text-sm font-semibold text-brand-600"
                    onClick={() => {
                      setEditingId(p.id);
                      setEditName(p.name);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    className="text-sm font-semibold text-neutral-500"
                    onClick={() => toggleActive(p)}
                    disabled={isPending}
                  >
                    {p.active ? "Archivar" : "Reactivar"}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

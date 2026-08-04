"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBusinessProfile } from "@/actions/business";
import { CATEGORIES } from "@/lib/config";

interface BusinessProfile {
  name: string;
  category: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  coverImage: string | null;
  published: boolean;
  slug: string;
}

export default function BusinessProfileForm({ business }: { business: BusinessProfile }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: business.name,
    category: business.category,
    description: business.description ?? "",
    address: business.address ?? "",
    phone: business.phone ?? "",
    whatsapp: business.whatsapp ?? "",
    coverImage: business.coverImage ?? "",
    published: business.published,
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateBusinessProfile(form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-neutral-900">Datos del negocio</h2>

        <div>
          <label className="label">Nombre</label>
          <input className="input" value={form.name} onChange={(e) => update("name", e.target.value)} required />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Categoría</label>
            <select className="input" value={form.category} onChange={(e) => update("category", e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Teléfono</label>
            <input className="input" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Descripción</label>
          <textarea
            className="input"
            rows={3}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </div>

        <div>
          <label className="label">Dirección</label>
          <input className="input" value={form.address} onChange={(e) => update("address", e.target.value)} />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">WhatsApp (con código de país)</label>
            <input
              className="input"
              placeholder="5491122334455"
              value={form.whatsapp}
              onChange={(e) => update("whatsapp", e.target.value)}
            />
          </div>
          <div>
            <label className="label">URL de imagen de portada</label>
            <input
              className="input"
              placeholder="https://..."
              value={form.coverImage}
              onChange={(e) => update("coverImage", e.target.value)}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => update("published", e.target.checked)}
          />
          Visible públicamente en la plataforma
        </label>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      {saved && !error && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">Cambios guardados.</p>}

      <button disabled={isPending} className="btn-primary">
        {isPending ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}

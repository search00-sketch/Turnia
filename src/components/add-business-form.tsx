"use client";

import { useState } from "react";
import { addBusinessToMyAccount } from "@/actions/auth";
import { goAfterAuth } from "@/lib/callback-url";
import { CATEGORIES } from "@/lib/config";
import { Sketch } from "@/components/sketch";

/** Un cliente con sesión iniciada suma su negocio a su misma cuenta. */
export default function AddBusinessForm({ user }: { user: { name: string; email: string; phone: string | null } }) {
  const [form, setForm] = useState({
    businessName: "",
    category: CATEGORIES[0].slug,
    phone: user.phone ?? "",
    whatsapp: "",
    address: "",
    description: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await addBusinessToMyAccount(form);
    if (!res.ok) {
      setError(res.error === "AUTH_REQUIRED" ? "Tu sesión venció. Volvé a ingresar." : res.error);
      setLoading(false);
      return;
    }
    goAfterAuth("/panel");
  }

  return (
    <div className="section max-w-2xl py-10 md:py-16">
      <div className="card p-6 md:p-8">
        <div className="flex items-start gap-4 mb-6">
          <Sketch name="scissors" className="h-12 w-12 shrink-0 text-brand-600" />
          <div>
            <h1 className="text-2xl font-extrabold text-plum-900">Sumá tu negocio</h1>
            <p className="text-sm text-plum-500 mt-1">
              Lo vas a administrar con tu misma cuenta (<b className="text-plum-900">{user.email}</b>). Vas a seguir
              pudiendo reservar turnos y ver los tuyos en "Mis turnos".
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="businessName">Nombre del negocio</label>
            <input id="businessName" required className="input" value={form.businessName} onChange={(e) => update("businessName", e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="category">Categoría</label>
              <select id="category" className="input" value={form.category} onChange={(e) => update("category", e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="phone">Teléfono del negocio</label>
              <input id="phone" className="input" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="whatsapp">WhatsApp (con código de país)</label>
              <input id="whatsapp" placeholder="5491122334455" className="input" value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="address">Dirección</label>
              <input id="address" className="input" value={form.address} onChange={(e) => update("address", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="description">Descripción</label>
            <textarea id="description" rows={3} className="input" value={form.description} onChange={(e) => update("description", e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? "Creando tu negocio..." : "Crear mi negocio"}
          </button>
          <p className="text-xs text-plum-400 text-center">
            Después vas a cargar servicios, profesionales y horarios desde tu panel.
          </p>
        </form>
      </div>
    </div>
  );
}

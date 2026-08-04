"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { firebaseErrorMessage } from "@/lib/firebase-errors";
import { registerBusiness } from "@/actions/auth";
import { createSessionCookie } from "@/actions/session";
import { CATEGORIES } from "@/lib/config";

export default function RegistroNegocioPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    ownerName: "",
    ownerLastName: "",
    email: "",
    phone: "",
    password: "",
    businessName: "",
    category: CATEGORIES[0].slug,
    address: "",
    whatsapp: "",
    description: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), form.email, form.password);
      const idToken = await credential.user.getIdToken();

      const result = await registerBusiness({
        idToken,
        ownerName: form.ownerName,
        ownerLastName: form.ownerLastName,
        phone: form.phone,
        businessName: form.businessName,
        category: form.category,
        address: form.address,
        whatsapp: form.whatsapp,
        description: form.description,
      });

      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }

      const sessionResult = await createSessionCookie(idToken);
      setLoading(false);

      if (!sessionResult.ok) {
        router.push("/login");
        return;
      }

      router.push("/panel");
      router.refresh();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setError(firebaseErrorMessage(code));
      setLoading(false);
    }
  }

  return (
    <div className="section max-w-2xl py-16">
      <div className="card p-8">
        <h1 className="text-2xl font-bold mb-1">Publicá tu negocio</h1>
        <p className="text-neutral-500 text-sm mb-6">
          Creá tu cuenta de negocio: vas a poder cargar tus servicios, profesionales y horarios,
          y empezar a recibir reservas online.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-neutral-800 mb-3">Tus datos</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="ownerName">Nombre</label>
                <input id="ownerName" required className="input" value={form.ownerName} onChange={(e) => update("ownerName", e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="ownerLastName">Apellido</label>
                <input id="ownerLastName" className="input" value={form.ownerLastName} onChange={(e) => update("ownerLastName", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input id="email" type="email" required className="input" value={form.email} onChange={(e) => update("email", e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="phone">Teléfono</label>
                <input id="phone" className="input" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
              </div>
            </div>
            <div className="mt-3">
              <label className="label" htmlFor="password">Contraseña</label>
              <input id="password" type="password" required minLength={6} className="input" value={form.password} onChange={(e) => update("password", e.target.value)} />
            </div>
          </div>

          <div className="border-t border-neutral-100 pt-6">
            <h2 className="text-sm font-semibold text-neutral-800 mb-3">Tu negocio</h2>
            <div>
              <label className="label" htmlFor="businessName">Nombre del negocio</label>
              <input id="businessName" required className="input" value={form.businessName} onChange={(e) => update("businessName", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="label" htmlFor="category">Categoría</label>
                <select id="category" className="input" value={form.category} onChange={(e) => update("category", e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="whatsapp">WhatsApp (con código de país)</label>
                <input id="whatsapp" placeholder="5491122334455" className="input" value={form.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} />
              </div>
            </div>
            <div className="mt-3">
              <label className="label" htmlFor="address">Dirección</label>
              <input id="address" className="input" value={form.address} onChange={(e) => update("address", e.target.value)} />
            </div>
            <div className="mt-3">
              <label className="label" htmlFor="description">Descripción</label>
              <textarea id="description" rows={3} className="input" value={form.description} onChange={(e) => update("description", e.target.value)} />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creando cuenta..." : "Crear mi negocio"}
          </button>
        </form>

        <p className="mt-6 text-sm text-neutral-500">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="text-brand-600 font-medium">Ingresá</Link>
        </p>
      </div>
    </div>
  );
}

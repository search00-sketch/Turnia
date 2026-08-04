"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { firebaseErrorMessage } from "@/lib/firebase-errors";
import { registerClient } from "@/actions/auth";
import { createSessionCookie } from "@/actions/session";

export default function RegistroPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
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

      const result = await registerClient({
        idToken,
        name: form.name,
        lastName: form.lastName,
        phone: form.phone,
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

      router.push("/");
      router.refresh();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setError(firebaseErrorMessage(code));
      setLoading(false);
    }
  }

  return (
    <div className="section max-w-md py-16">
      <div className="card p-8">
        <h1 className="text-2xl font-bold mb-1">Creá tu cuenta</h1>
        <p className="text-neutral-500 text-sm mb-6">
          Registrate para reservar turnos en los negocios de la plataforma.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="name">Nombre</label>
              <input id="name" required className="input" value={form.name} onChange={(e) => update("name", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="lastName">Apellido</label>
              <input id="lastName" className="input" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="phone">Teléfono</label>
            <input id="phone" className="input" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required className="input" value={form.email} onChange={(e) => update("email", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <input id="password" type="password" required minLength={6} className="input" value={form.password} onChange={(e) => update("password", e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creando cuenta..." : "Registrarme"}
          </button>
        </form>

        <div className="mt-6 text-sm text-neutral-500 space-y-1">
          <p>
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="text-brand-600 font-medium">Ingresá</Link>
          </p>
          <p>
            ¿Sos dueño de un negocio?{" "}
            <Link href="/registro-negocio" className="text-brand-600 font-medium">Publicá tu negocio</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

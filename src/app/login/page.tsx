"use client";

import { Suspense, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { firebaseErrorMessage } from "@/lib/firebase-errors";
import { createSessionCookie } from "@/actions/session";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      const idToken = await credential.user.getIdToken();
      const result = await createSessionCookie(idToken);

      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }

      router.push(callbackUrl);
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
        <h1 className="text-2xl font-bold mb-1">Ingresá a tu cuenta</h1>
        <p className="text-neutral-500 text-sm mb-6">
          Accedé para reservar turnos o gestionar tu negocio.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <div className="mt-6 text-sm text-neutral-500 space-y-1">
          <p>
            ¿No tenés cuenta?{" "}
            <Link href="/registro" className="text-brand-600 font-medium">
              Registrate
            </Link>
          </p>
          <p>
            ¿Sos dueño de un negocio?{" "}
            <Link href="/registro-negocio" className="text-brand-600 font-medium">
              Publicá tu negocio
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

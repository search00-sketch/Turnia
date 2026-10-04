"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { User } from "firebase/auth";
import {
  getOrCreateAuthAccount,
  rollbackAuthAccount,
  sendVerificationEmail,
  signInWithGoogle,
} from "@/lib/register-account";
import { firebaseErrorMessage } from "@/lib/firebase-errors";
import { registerClient, registerGoogleClient } from "@/actions/auth";
import { createSessionCookie } from "@/actions/session";
import { goAfterAuth, safeCallbackUrl } from "@/lib/callback-url";
import EmailInput from "@/components/email-input";
import GoogleButton, { OrDivider } from "@/components/google-button";
import VerifyEmailNotice from "@/components/verify-email-notice";

function RegistroForm() {
  const callbackUrl = safeCallbackUrl(useSearchParams().get("callbackUrl"));
  const [form, setForm] = useState({
    name: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState<User | null>(null);

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const account = await getOrCreateAuthAccount(form.email, form.password);
    if (!account.ok) {
      setError(account.error);
      setLoading(false);
      return;
    }

    let registered = false;
    try {
      const idToken = await account.user.getIdToken();

      const result = await registerClient({
        idToken,
        name: form.name,
        lastName: form.lastName,
        phone: form.phone,
      });

      if (!result.ok) {
        await rollbackAuthAccount(account.user, account.createdNow);
        setError(result.error);
        setLoading(false);
        return;
      }
      registered = true;

      if (result.needsVerification) {
        const sent = await sendVerificationEmail(account.user);
        if (!sent.ok) setError(`Tu cuenta se creó, pero no pudimos mandar el mail de confirmación: ${sent.error}`);
        setPendingVerification(account.user);
        setLoading(false);
        return;
      }

      const sessionResult = await createSessionCookie(idToken);
      setLoading(false);

      if (!sessionResult.ok) {
        goAfterAuth("/login");
        return;
      }

      goAfterAuth(callbackUrl || "/");
    } catch (err) {
      if (!registered) await rollbackAuthAccount(account.user, account.createdNow);
      const code = (err as { code?: string })?.code;
      setError(firebaseErrorMessage(code));
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    const res = await signInWithGoogle();
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    const idToken = await res.user.getIdToken();
    const registered = await registerGoogleClient(idToken);
    if (!registered.ok) {
      setError(registered.error);
      setLoading(false);
      return;
    }
    const sessionResult = await createSessionCookie(idToken);
    if (!sessionResult.ok) {
      setError(sessionResult.error);
      setLoading(false);
      return;
    }
    goAfterAuth(callbackUrl || "/");
  }

  if (pendingVerification) {
    return (
      <div className="section max-w-md py-16">
        <div className="card p-8 space-y-4">
          <h1 className="text-2xl font-bold">¡Cuenta creada!</h1>
          <VerifyEmailNotice email={pendingVerification.email ?? form.email} user={pendingVerification} />
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <Link href={callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login"} className="btn-primary w-full">
            Ir a ingresar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="section max-w-md py-16">
      <div className="card p-8">
        <h1 className="text-2xl font-bold mb-1">Creá tu cuenta</h1>
        <p className="text-neutral-500 text-sm mb-6">
          Registrate para reservar turnos en los negocios de la plataforma.
        </p>

        <div className="space-y-4 mb-4">
          <GoogleButton onClick={handleGoogle} disabled={loading} label="Registrarme con Google" />
          <OrDivider />
        </div>

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
            <EmailInput value={form.email} onChange={(v) => update("email", v)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <input id="password" type="password" required minLength={6} autoComplete="new-password" className="input" value={form.password} onChange={(e) => update("password", e.target.value)} />
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

export default function RegistroPage() {
  return (
    <Suspense>
      <RegistroForm />
    </Suspense>
  );
}

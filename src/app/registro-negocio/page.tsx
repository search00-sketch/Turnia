"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";
import Link from "next/link";
import {
  getOrCreateAuthAccount,
  rollbackAuthAccount,
  sendVerificationEmail,
  signInWithGoogle,
} from "@/lib/register-account";
import EmailInput from "@/components/email-input";
import GoogleButton, { OrDivider } from "@/components/google-button";
import VerifyEmailNotice from "@/components/verify-email-notice";
import { firebaseErrorMessage } from "@/lib/firebase-errors";
import { registerBusiness } from "@/actions/auth";
import { createSessionCookie } from "@/actions/session";
import { CATEGORIES } from "@/lib/config";

function isGoogleUser(user: User | null): user is User {
  return Boolean(user?.providerData.some((p) => p.providerId === "google.com"));
}

function RegistroNegocioForm() {
  const router = useRouter();
  const params = useSearchParams();
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
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [pendingVerification, setPendingVerification] = useState<User | null>(null);

  function applyGoogleAccount(user: User) {
    const [first, ...rest] = (user.displayName ?? "").trim().split(/\s+/);
    setGoogleUser(user);
    setForm((f) => ({
      ...f,
      email: user.email ?? f.email,
      ownerName: f.ownerName || first || "",
      ownerLastName: f.ownerLastName || rest.join(" "),
    }));
  }

  // Viene de "Tengo un negocio" en el login con Google: reutiliza esa cuenta.
  useEffect(() => {
    if (params.get("google") !== "1") return;
    return onAuthStateChanged(getFirebaseAuth(), (user) => {
      if (isGoogleUser(user)) applyGoogleAccount(user);
    });
  }, [params]);

  async function handleGoogle() {
    setError(null);
    const res = await signInWithGoogle();
    if (!res.ok) {
      setError(res.error);
      return;
    }
    applyGoogleAccount(res.user);
  }

  async function stopUsingGoogle() {
    await signOut(getFirebaseAuth()).catch(() => {});
    setGoogleUser(null);
    setForm((f) => ({ ...f, email: "" }));
  }

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const account = googleUser
      ? ({ ok: true, user: googleUser, createdNow: false } as const)
      : await getOrCreateAuthAccount(form.email, form.password);
    if (!account.ok) {
      setError(account.error);
      setLoading(false);
      return;
    }

    let registered = false;
    try {
      const idToken = await account.user.getIdToken();

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
        // Con Google no se deshace nada: puede corregir el formulario y reintentar.
        if (!googleUser) await rollbackAuthAccount(account.user, account.createdNow);
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
        router.push("/login");
        return;
      }

      router.push("/panel");
      router.refresh();
    } catch (err) {
      if (!registered && !googleUser) await rollbackAuthAccount(account.user, account.createdNow);
      const code = (err as { code?: string })?.code;
      setError(firebaseErrorMessage(code));
      setLoading(false);
    }
  }

  if (pendingVerification) {
    return (
      <div className="section max-w-md py-16">
        <div className="card p-8 space-y-4">
          <h1 className="text-2xl font-bold">¡Tu negocio está creado!</h1>
          <VerifyEmailNotice email={pendingVerification.email ?? form.email} user={pendingVerification} />
          <p className="text-sm text-neutral-500">
            Cuando confirmes el email, ingresá y vas a ver tu panel para cargar servicios, profesionales y horarios.
          </p>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <Link href="/login?callbackUrl=/panel" className="btn-primary w-full">
            Ir a ingresar
          </Link>
        </div>
      </div>
    );
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
            {googleUser ? (
              <p className="text-sm text-neutral-600 bg-neutral-50 rounded-lg px-3 py-2 mb-3">
                Vas a ingresar con tu cuenta de Google <strong>{googleUser.email}</strong>.{" "}
                <button type="button" className="font-semibold text-brand-600 underline" onClick={stopUsingGoogle}>
                  Usar otro email
                </button>
              </p>
            ) : (
              <div className="space-y-4 mb-4">
                <GoogleButton onClick={handleGoogle} disabled={loading} label="Usar mi cuenta de Google" />
                <OrDivider />
              </div>
            )}
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
                <EmailInput value={form.email} onChange={(v) => update("email", v)} disabled={Boolean(googleUser)} />
              </div>
              <div>
                <label className="label" htmlFor="phone">Teléfono</label>
                <input id="phone" className="input" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
              </div>
            </div>
            {!googleUser && (
              <div className="mt-3">
                <label className="label" htmlFor="password">Contraseña</label>
                <input id="password" type="password" required minLength={6} autoComplete="new-password" className="input" value={form.password} onChange={(e) => update("password", e.target.value)} />
              </div>
            )}
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

export default function RegistroNegocioPage() {
  return (
    <Suspense>
      <RegistroNegocioForm />
    </Suspense>
  );
}

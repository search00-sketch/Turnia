"use client";

import { Suspense, useState } from "react";
import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { firebaseErrorMessage } from "@/lib/firebase-errors";
import { createSessionCookie, clearSessionCookie } from "@/actions/session";
import { registerGoogleClient } from "@/actions/auth";
import { signInWithGoogle } from "@/lib/register-account";
import { normalizeEmail } from "@/lib/email-typos";
import { goAfterAuth, safeCallbackUrl } from "@/lib/callback-url";
import EmailInput from "@/components/email-input";
import GoogleButton, { OrDivider } from "@/components/google-button";
import VerifyEmailNotice from "@/components/verify-email-notice";

function LoginForm() {
  const params = useSearchParams();
  const callbackUrl = safeCallbackUrl(params.get("callbackUrl"));
  const withCallback = (path: string) => (callbackUrl ? `${path}?callbackUrl=${encodeURIComponent(callbackUrl)}` : path);
  const justVerified = params.get("verificado") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [incomplete, setIncomplete] = useState(false);
  const [unverifiedUser, setUnverifiedUser] = useState<User | null>(null);
  const [googleNewUser, setGoogleNewUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  function resetMessages() {
    setError(null);
    setInfo(null);
    setIncomplete(false);
    setUnverifiedUser(null);
    setGoogleNewUser(null);
  }

  /** Cambia la cuenta de Firebase por la cookie de sesión y resuelve los casos especiales. */
  async function finishLogin(user: User, viaGoogle: boolean) {
    // Token nuevo: si recién confirmó el email, así llega email_verified actualizado.
    const idToken = await user.getIdToken(true);
    const result = await createSessionCookie(idToken);

    if (!result.ok) {
      if (result.error === "EMAIL_NOT_VERIFIED") setUnverifiedUser(user);
      else setError(result.error);
      setLoading(false);
      return;
    }

    if (!result.hasProfile) {
      await clearSessionCookie();
      if (viaGoogle) {
        setGoogleNewUser(user);
      } else {
        await signOut(getFirebaseAuth()).catch(() => {});
        setIncomplete(true);
      }
      setLoading(false);
      return;
    }

    // Sin destino pedido, cada uno va a su lugar: el negocio a su panel, el admin al suyo.
    const home = result.role === "NEGOCIO" ? "/panel" : result.role === "ADMIN" ? "/admin" : "/";
    goAfterAuth(callbackUrl || home);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(getFirebaseAuth(), normalizeEmail(email), password);
      await finishLogin(credential.user, false);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      setError(firebaseErrorMessage(code));
      setLoading(false);
    }
  }

  async function handleGoogle() {
    resetMessages();
    setLoading(true);
    const res = await signInWithGoogle();
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    await finishLogin(res.user, true);
  }

  async function handleAlreadyVerified() {
    if (!unverifiedUser) return;
    setLoading(true);
    setError(null);
    await unverifiedUser.reload().catch(() => {});
    const user = unverifiedUser;
    setUnverifiedUser(null);
    await finishLogin(user, false);
  }

  async function handleGoogleAsClient() {
    if (!googleNewUser) return;
    setLoading(true);
    const res = await registerGoogleClient(await googleNewUser.getIdToken());
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    const user = googleNewUser;
    setGoogleNewUser(null);
    await finishLogin(user, true);
  }

  async function handleForgotPassword() {
    resetMessages();
    if (!email.trim()) {
      setError("Escribí tu email arriba y volvé a tocar \"¿Olvidaste tu contraseña?\".");
      return;
    }
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), normalizeEmail(email));
      setInfo(`Si existe una cuenta con ${normalizeEmail(email)}, te mandamos un mail para elegir una contraseña nueva.`);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/user-not-found") {
        setInfo(`Si existe una cuenta con ${normalizeEmail(email)}, te mandamos un mail para elegir una contraseña nueva.`);
      } else {
        setError(firebaseErrorMessage(code));
      }
    }
  }

  return (
    <div className="section max-w-md py-16">
      <div className="card p-8">
        <h1 className="text-2xl font-bold mb-1">Ingresá a tu cuenta</h1>
        <p className="text-neutral-500 text-sm mb-6">
          Accedé para reservar turnos o gestionar tu negocio.
        </p>

        {justVerified && !error && (
          <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-4">
            ¡Listo! Tu email quedó confirmado. Ya podés ingresar.
          </p>
        )}

        {googleNewUser ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-700">
              Es la primera vez que entrás con <strong>{googleNewUser.email}</strong>. ¿Cómo vas a usar la plataforma?
            </p>
            <button type="button" onClick={handleGoogleAsClient} disabled={loading} className="btn-primary w-full">
              {loading ? "Creando tu cuenta..." : "Soy cliente: quiero reservar turnos"}
            </button>
            <Link href="/registro-negocio?google=1" className="btn-secondary w-full">
              Tengo un negocio: quiero publicarlo
            </Link>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <GoogleButton onClick={handleGoogle} disabled={loading} />
            <OrDivider />

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label" htmlFor="email">Email</label>
                <EmailInput value={email} onChange={setEmail} />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="label" htmlFor="password">Contraseña</label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs font-medium text-brand-600 mb-1.5"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {unverifiedUser && (
                <VerifyEmailNotice
                  email={unverifiedUser.email ?? email}
                  user={unverifiedUser}
                  onConfirmed={handleAlreadyVerified}
                />
              )}
              {incomplete && (
                <div className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
                  Tu cuenta quedó a medio registrar. Completá el registro con este mismo email y contraseña:{" "}
                  <Link href="/registro" className="font-semibold underline">
                    soy cliente
                  </Link>{" "}
                  o{" "}
                  <Link href="/registro-negocio" className="font-semibold underline">
                    tengo un negocio
                  </Link>
                  .
                </div>
              )}
              {info && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{info}</p>}
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "Ingresando..." : "Ingresar"}
              </button>
            </form>
          </div>
        )}

        <div className="mt-6 text-sm text-neutral-500 space-y-1">
          <p>
            ¿No tenés cuenta?{" "}
            <Link href={withCallback("/registro")} className="text-brand-600 font-medium">
              Registrate
            </Link>
          </p>
          <p>
            ¿Sos dueño de un negocio?{" "}
            <Link href={withCallback("/registro-negocio")} className="text-brand-600 font-medium">
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

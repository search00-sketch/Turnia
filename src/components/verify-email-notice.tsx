"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { sendVerificationEmail } from "@/lib/register-account";

/** Aviso de "confirmá tu email", con opción de reenviar el mail y de reintentar una vez confirmado. */
export default function VerifyEmailNotice({
  email,
  user,
  onConfirmed,
}: {
  email: string;
  user: User | null;
  onConfirmed?: () => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function resend() {
    if (!user) return;
    setBusy(true);
    const res = await sendVerificationEmail(user);
    setStatus(res.ok ? "Listo, te lo volvimos a mandar." : res.error);
    setBusy(false);
  }

  return (
    <div className="rounded-lg bg-brand-50 border border-brand-100 px-4 py-3 text-sm text-neutral-700 space-y-2">
      <p className="font-semibold text-neutral-900">Confirmá tu email</p>
      <p>
        Te mandamos un mail a <strong>{email}</strong> con un link para confirmar tu cuenta. Abrilo (revisá también
        spam o promociones) y después ingresá.
      </p>
      <div className="flex flex-wrap gap-4">
        {onConfirmed && (
          <button type="button" className="font-semibold text-brand-700 underline" onClick={onConfirmed} disabled={busy}>
            Ya lo confirmé, ingresar
          </button>
        )}
        {user && (
          <button type="button" className="font-semibold text-neutral-600 underline" onClick={resend} disabled={busy}>
            Reenviar mail
          </button>
        )}
      </div>
      {status && <p className="text-xs text-neutral-500">{status}</p>}
    </div>
  );
}

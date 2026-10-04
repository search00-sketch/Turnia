"use client";

import { useState, useTransition } from "react";
import { setMyEmailOptOut } from "@/actions/email-preferences";

/** Interruptor "Recibir mails de Turnia" en la página Cuenta. */
export default function EmailToggle({ optOut }: { optOut: boolean }) {
  const [receive, setReceive] = useState(!optOut);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !receive;
    setReceive(next);
    startTransition(async () => {
      const res = await setMyEmailOptOut(!next);
      if (!res.ok) setReceive(!next);
    });
  }

  return (
    <label className="flex items-center gap-3 px-5 py-4 cursor-pointer">
      <span className="flex-1">
        <span className="block font-semibold text-plum-900">Recibir mails de Turnia</span>
        <span className="block text-xs text-plum-500">Confirmaciones, recordatorios y cancelaciones de turnos</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={receive}
        onClick={toggle}
        disabled={isPending}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${receive ? "bg-brand-600" : "bg-plum-200"}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${receive ? "left-6" : "left-1"}`} />
      </button>
    </label>
  );
}

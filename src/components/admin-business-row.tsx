"use client";

import { useState, useTransition } from "react";
import { adminSetBusinessPublished, adminSetBusinessPaidUntil } from "@/actions/admin";

export interface AdminBusinessRowData {
  id: string;
  name: string;
  category: string;
  createdAt: string; // ya formateada
  published: boolean;
  /** Tiene al menos un servicio y un profesional activos (si no, no aparece en el marketplace). */
  bookable: boolean;
  paidUntilISO: string | null; // "yyyy-MM-dd" o null
  paymentLabel: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
}

export default function AdminBusinessRow({ business }: { business: AdminBusinessRowData }) {
  const [isPending, startTransition] = useTransition();
  const [paidUntil, setPaidUntil] = useState(business.paidUntilISO ?? "");
  const [saved, setSaved] = useState(false);

  function togglePublished() {
    const goingToUnpublish = business.published;
    if (goingToUnpublish) {
      const confirmed = window.confirm(
        `¿Despublicar "${business.name}"? Va a desaparecer del marketplace público. El dueño va a seguir pudiendo entrar a su panel.`
      );
      if (!confirmed) return;
    }
    startTransition(async () => {
      await adminSetBusinessPublished(business.id, !business.published);
    });
  }

  function savePaidUntil() {
    startTransition(async () => {
      await adminSetBusinessPaidUntil(business.id, paidUntil || null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <tr className="border-b border-neutral-50 last:border-0 align-top">
      <td className="py-3 pr-4">
        <p className="font-medium text-neutral-900">{business.name}</p>
        <p className="text-xs text-neutral-500">{business.category}</p>
      </td>
      <td className="py-3 pr-4 text-neutral-600">
        <p>{business.ownerName}</p>
        <p className="text-xs">{business.ownerEmail}</p>
        {business.ownerPhone && <p className="text-xs">{business.ownerPhone}</p>}
      </td>
      <td className="py-3 pr-4 text-neutral-600 whitespace-nowrap">{business.createdAt}</td>
      <td className="py-3 pr-4">
        <button
          onClick={togglePublished}
          disabled={isPending}
          className={`text-xs font-semibold rounded-full px-2.5 py-1 disabled:opacity-50 ${
            business.published ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
          }`}
        >
          {business.published ? "Publicado" : "Despublicado"}
        </button>
        {business.published && !business.bookable && (
          <p className="text-xs text-amber-700 mt-1 max-w-[180px]">
            No aparece en el buscador: le faltan servicios o profesionales activos.
          </p>
        )}
      </td>
      <td className="py-3">
        <p className="text-xs text-neutral-500 mb-1">{business.paymentLabel}</p>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={paidUntil}
            onChange={(e) => setPaidUntil(e.target.value)}
            className="input text-xs py-1"
          />
          <button
            onClick={savePaidUntil}
            disabled={isPending}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50 shrink-0"
          >
            Guardar
          </button>
          {saved && <span className="text-xs text-green-700 shrink-0">✓</span>}
        </div>
      </td>
    </tr>
  );
}

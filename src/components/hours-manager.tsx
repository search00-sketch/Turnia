"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBusinessHours } from "@/actions/hours";
import { DAYS_OF_WEEK } from "@/lib/config";

interface HourItem {
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

export default function HoursManager({ hours }: { hours: HourItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<HourItem[]>(
    Array.from({ length: 7 }, (_, dayOfWeek) => {
      const existing = hours.find((h) => h.dayOfWeek === dayOfWeek);
      return existing ?? { dayOfWeek, isClosed: dayOfWeek === 0, openTime: "10:00", closeTime: "20:00" };
    })
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateRow(dayOfWeek: number, patch: Partial<HourItem>) {
    setRows((rs) => rs.map((r) => (r.dayOfWeek === dayOfWeek ? { ...r, ...patch } : r)));
    setSaved(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateBusinessHours(rows);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="font-semibold text-neutral-900">Horarios de atención</h2>
      <div className="card divide-y divide-neutral-100">
        {rows.map((row) => (
          <div key={row.dayOfWeek} className="p-4 flex flex-wrap items-center gap-4">
            <span className="w-28 font-medium text-neutral-800">{DAYS_OF_WEEK[row.dayOfWeek]}</span>

            <label className="flex items-center gap-2 text-sm text-neutral-600">
              <input
                type="checkbox"
                checked={!row.isClosed}
                onChange={(e) => updateRow(row.dayOfWeek, { isClosed: !e.target.checked })}
              />
              Abierto
            </label>

            {!row.isClosed && (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  className="input w-32"
                  value={row.openTime ?? "10:00"}
                  onChange={(e) => updateRow(row.dayOfWeek, { openTime: e.target.value })}
                />
                <span className="text-neutral-400">a</span>
                <input
                  type="time"
                  className="input w-32"
                  value={row.closeTime ?? "20:00"}
                  onChange={(e) => updateRow(row.dayOfWeek, { closeTime: e.target.value })}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      {saved && !error && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">Horarios guardados.</p>}

      <button disabled={isPending} className="btn-primary">
        {isPending ? "Guardando..." : "Guardar horarios"}
      </button>
    </form>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/image-compress";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Botones para subir, cambiar o quitar una foto. La foto se achica en el
 * navegador antes de mandarse (ver compressImage) y la guarda `onSave`.
 */
export default function ImageUploader({
  currentUrl,
  width,
  height,
  maxBytes,
  onSave,
  preview,
  compact = false,
}: {
  currentUrl: string | null;
  width: number;
  height: number;
  maxBytes: number;
  onSave: (dataUrl: string | null) => Promise<Result>;
  /** Cómo se ve la foto (recibe la URL actual o la vista previa local). */
  preview: (src: string | null) => React.ReactNode;
  compact?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const shown = localPreview ?? currentUrl;

  function save(dataUrl: string | null) {
    setError(null);
    startTransition(async () => {
      const res = await onSave(dataUrl);
      if (!res.ok) {
        setError(res.error);
        setLocalPreview(null);
        return;
      }
      router.refresh();
      setLocalPreview(null);
    });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await compressImage(file, { width, height, maxBytes });
      setLocalPreview(dataUrl);
      save(dataUrl);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className={compact ? "flex items-center gap-3" : "space-y-3"}>
      {preview(shown)}
      <div className="flex flex-wrap items-center gap-3">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
          className="text-sm font-semibold text-brand-600 disabled:opacity-50"
        >
          {isPending ? "Guardando..." : shown ? "Cambiar foto" : "Subir foto"}
        </button>
        {shown && !isPending && (
          <button type="button" onClick={() => save(null)} className="text-sm font-semibold text-neutral-400 hover:text-red-600">
            Quitar
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

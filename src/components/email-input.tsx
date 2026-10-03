"use client";

import { suggestEmailFix } from "@/lib/email-typos";

/** Campo de email que sugiere la corrección de errores de tipeo comunes ("gmial.com" → "gmail.com"). */
export default function EmailInput({
  id = "email",
  value,
  onChange,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const suggestion = suggestEmailFix(value);

  return (
    <div>
      <input
        id={id}
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        className="input"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onChange(e.target.value.trim())}
      />
      {suggestion && (
        <p className="text-xs text-amber-700 mt-1">
          ¿Quisiste decir{" "}
          <button type="button" className="font-semibold underline" onClick={() => onChange(suggestion)}>
            {suggestion}
          </button>
          ?
        </p>
      )}
    </div>
  );
}

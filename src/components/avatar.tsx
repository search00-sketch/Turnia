/** Foto redonda de una persona, o sus iniciales si no tiene foto. */
export default function Avatar({ name, src, size = 40 }: { name: string; src: string | null; size?: number }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      className="rounded-full object-cover shrink-0 bg-neutral-100"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="rounded-full bg-brand-100 text-brand-700 font-semibold flex items-center justify-center shrink-0"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

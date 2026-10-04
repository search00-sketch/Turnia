// Dibujos a lápiz de Turnia: un filtro SVG que deforma levemente los trazos
// (para que parezcan hechos a mano) y un set de ilustraciones por rubro.
// <SketchDefs /> va una sola vez en el layout; <Sketch name="..." /> los usa.

export type SketchName =
  | "scissors"
  | "comb"
  | "polish"
  | "mirror"
  | "dryer"
  | "leaf"
  | "sparkle"
  | "calendar"
  | "underline"
  | "loop"
  | "arrow";

/** Dibujo principal de cada rubro (para chips, tarjetas sin foto, etc.). */
export const CATEGORY_SKETCH: Record<string, SketchName> = {
  peluqueria: "scissors",
  barberia: "comb",
  unas: "polish",
  estetica: "mirror",
  depilacion: "sparkle",
  spa: "leaf",
  otros: "sparkle",
};

/** Tres dibujos que acompañan al rubro en la imagen de reemplazo. */
export const CATEGORY_SCENE: Record<string, [SketchName, SketchName, SketchName]> = {
  peluqueria: ["dryer", "scissors", "comb"],
  barberia: ["scissors", "comb", "mirror"],
  unas: ["polish", "sparkle", "leaf"],
  estetica: ["mirror", "sparkle", "leaf"],
  depilacion: ["sparkle", "mirror", "leaf"],
  spa: ["leaf", "sparkle", "leaf"],
  otros: ["sparkle", "mirror", "comb"],
};

export function SketchDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <filter id="pencil" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" />
        </filter>
      </defs>
      <symbol id="sk-underline" viewBox="0 0 120 12" preserveAspectRatio="none">
        <path d="M2 8c18-5 34-6 52-3s38 2 64-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M8 10c22-3 46-3 70-1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".6" />
      </symbol>
      <symbol id="sk-loop" viewBox="0 0 100 60" preserveAspectRatio="none">
        <path d="M18 8C42-1 86 2 94 22s-18 34-52 34S2 46 5 28 30 5 60 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </symbol>
      <symbol id="sk-scissors" viewBox="0 0 48 48">
        <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="12" cy="13" r="6.5" />
          <circle cx="12" cy="35" r="6.5" />
          <path d="M17.5 16.5L43 38M17.5 31.5L43 10" />
        </g>
      </symbol>
      <symbol id="sk-comb" viewBox="0 0 48 48">
        <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 14h36c1.6 0 2 1 2 2v5H4v-5c0-1 .5-2 2-2z" />
          <path d="M8 21v14M12 21v16M16 21v14M20 21v16M24 21v14M28 21v16M32 21v14M36 21v16M40 21v14" />
        </g>
      </symbol>
      <symbol id="sk-polish" viewBox="0 0 48 48">
        <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 4h10v12H19z" />
          <path d="M16 18h16c3 0 5 2.5 5 5.5V40c0 2-1.5 4-4 4H15c-2.5 0-4-2-4-4V23.5c0-3 2-5.5 5-5.5z" />
          <path d="M16 27c4-2 12-2 16 0" opacity=".6" />
        </g>
      </symbol>
      <symbol id="sk-mirror" viewBox="0 0 48 48">
        <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <ellipse cx="24" cy="17" rx="12" ry="13" />
          <ellipse cx="24" cy="17" rx="8.5" ry="9.5" opacity=".55" />
          <path d="M24 30v14M20 44h8" />
        </g>
      </symbol>
      <symbol id="sk-dryer" viewBox="0 0 48 48">
        <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="17" cy="18" r="11" />
          <circle cx="17" cy="18" r="4" />
          <path d="M27 13h14v10H27M16 29l3 15h6l-2-14" />
          <path d="M44 12c4 2 4 10 0 12" opacity=".6" />
        </g>
      </symbol>
      <symbol id="sk-leaf" viewBox="0 0 48 48">
        <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 40C8 20 22 8 42 6c0 20-12 34-34 34z" />
          <path d="M8 40L30 18M18 30l-1-8M24 24l7 1" opacity=".75" />
        </g>
      </symbol>
      <symbol id="sk-sparkle" viewBox="0 0 48 48">
        <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M24 4c1.5 9 5 13 16 16-11 3-14.5 7-16 16-1.5-9-5-13-16-16 11-3 14.5-7 16-16z" />
          <path d="M40 34c.6 3.5 2 5 6 6-4 1-5.4 2.5-6 6-.6-3.5-2-5-6-6 4-1 5.4-2.5 6-6z" />
        </g>
      </symbol>
      <symbol id="sk-calendar" viewBox="0 0 48 48">
        <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="10" width="36" height="32" rx="5" />
          <path d="M6 19h36M16 5v9M32 5v9M15 28l3 3 6-7" />
          <path d="M29 29h7M29 35h5" opacity=".6" />
        </g>
      </symbol>
      <symbol id="sk-arrow" viewBox="0 0 70 60">
        <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 6c22 2 38 14 40 42" />
          <path d="M40 40l10 10 8-12" />
        </g>
      </symbol>
    </svg>
  );
}

export function Sketch({ name, className = "" }: { name: SketchName; className?: string }) {
  return (
    <svg className={`sketch ${className}`} aria-hidden="true" focusable="false">
      <use href={`#sk-${name}`} />
    </svg>
  );
}

/** Subrayado a mano debajo de una palabra. */
export function Underlined({ children, className = "text-brand-300" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      {children}
      <svg
        className={`sketch absolute -left-[3%] -bottom-2 h-2.5 w-[106%] overflow-visible ${className}`}
        aria-hidden="true"
        focusable="false"
      >
        <use href="#sk-underline" />
      </svg>
    </span>
  );
}

/** Imagen de reemplazo para un negocio sin portada: dibujos de su rubro sobre papel arena. */
export function CategoryScene({
  category,
  className = "",
  large = false,
}: {
  category: string;
  className?: string;
  /** Dibujos más grandes en compu (portadas anchas). */
  large?: boolean;
}) {
  const [a, b, c] = CATEGORY_SCENE[category] ?? CATEGORY_SCENE.otros;
  const lg = large ? " md:scale-[1.7]" : "";
  return (
    <div className={`sand-surface flex items-center justify-center gap-2 text-plum-700 ${className}`} aria-hidden="true">
      <div className={`flex items-center gap-2${lg}`}>
        <Sketch name={a} className="h-14 w-14 -rotate-6" />
        <Sketch name={b} className="h-16 w-16" />
        <Sketch name={c} className="h-12 w-12 rotate-12" />
      </div>
    </div>
  );
}

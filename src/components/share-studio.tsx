"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { getAvailabilityForPost } from "@/actions/share";
import type { ShareDay } from "@/lib/share-availability";
import { DAYS_OF_WEEK } from "@/lib/config";
import { formatDuration, formatPrice } from "@/lib/format";
import {
  POST_FONT,
  POST_SIZE,
  renderAvailability,
  renderBookOnline,
  renderPrices,
  type AvailabilityDay,
  type PostFormat,
  type PostTheme,
  type PriceGroup,
} from "@/lib/post-render";

type Template = "turnos" | "servicios" | "online";
type SlotState = "free" | "taken" | "hidden";

interface ServiceOption {
  id: string;
  name: string;
  category: string;
  price: number;
  durationMin: number;
}

interface Props {
  business: { name: string; slug: string; whatsapp: string | null; coverUrl: string | null };
  link: string;
  services: ServiceOption[];
}

const TEMPLATES: { id: Template; title: string; text: string }[] = [
  { id: "turnos", title: "Turnos disponibles", text: "Tus horarios libres de los próximos días" },
  { id: "servicios", title: "Servicios y precios", text: "Tu lista de precios" },
  { id: "online", title: "Reservá online", text: "Contá que ya se puede reservar por internet" },
];

const NEXT_STATE: Record<SlotState, SlotState> = { free: "taken", taken: "hidden", hidden: "free" };

function dayLabel(d: ShareDay) {
  const [, m, day] = d.dateISO.split("-");
  return `${DAYS_OF_WEEK[d.weekday]} ${day}/${m}`;
}

/** Espera a que estén cargadas las letras del sitio para dibujar con ellas. */
let fontsReady: Promise<unknown> | null = null;
function loadFonts() {
  fontsReady ??= Promise.all(
    [300, 400, 500, 600, 700, 800].map((w) => document.fonts.load(`${w} 40px ${POST_FONT}`))
  ).catch(() => undefined);
  return fontsReady;
}

export default function ShareStudio({ business, link, services }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [template, setTemplate] = useState<Template>("turnos");
  const [format, setFormat] = useState<PostFormat>("story");
  const [theme, setTheme] = useState<PostTheme>(business.coverUrl ? "photo" : "plum");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [step, setStep] = useState<0 | 30 | 60>(60);
  const [daysCount, setDaysCount] = useState(4);
  const [showTaken, setShowTaken] = useState(true);
  const [days, setDays] = useState<ShareDay[] | null>(null);
  const [overrides, setOverrides] = useState<Record<string, SlotState>>({});
  const [cover, setCover] = useState<HTMLImageElement | null>(null);
  const [dropped, setDropped] = useState(0);
  const [caption, setCaption] = useState<string | null>(null); // null = texto sugerido
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [drawTick, setDrawTick] = useState(0);

  const linkLabel = link.replace(/^https?:\/\//, "");

  // Foto de portada para el fondo (misma página, así el canvas se puede exportar).
  useEffect(() => {
    if (!business.coverUrl) return;
    const img = new Image();
    img.onload = () => setCover(img);
    img.src = business.coverUrl;
  }, [business.coverUrl]);

  // Horarios reales de la agenda.
  useEffect(() => {
    if (template !== "turnos" || !serviceId) return;
    setError(null);
    startLoading(async () => {
      const res = await getAvailabilityForPost({ serviceId, step, days: daysCount });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDays(res.days);
      setOverrides({});
    });
  }, [template, serviceId, step, daysCount]);

  const slotState = (d: ShareDay, time: string): SlotState => {
    const o = overrides[`${d.dateISO} ${time}`];
    if (o) return o;
    if (d.free.includes(time)) return "free";
    return showTaken ? "taken" : "hidden";
  };

  const availability: AvailabilityDay[] = useMemo(() => {
    if (!days) return [];
    return days
      .map((d) => {
        const times = [...d.free, ...d.taken].sort();
        const items = times
          .map((time) => ({ time, state: slotState(d, time) }))
          .filter((i) => i.state !== "hidden")
          .map((i) => ({ time: i.time, taken: i.state === "taken" }));
        const anyFree = items.some((i) => !i.taken);
        return { label: dayLabel(d).toUpperCase(), items, full: !anyFree, hasTimes: times.length > 0 };
      })
      .filter((d) => d.hasTimes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, overrides, showTaken]);

  const priceGroups: PriceGroup[] = useMemo(() => {
    const groups = new Map<string, PriceGroup>();
    for (const s of services) {
      const key = s.category || "Servicios";
      if (!groups.has(key)) groups.set(key, { category: key, services: [] });
      groups.get(key)!.services.push({ name: s.name, price: formatPrice(s.price), duration: formatDuration(s.durationMin) });
    }
    return [...groups.values()];
  }, [services]);

  // Dibujo.
  useEffect(() => {
    let cancelled = false;
    loadFonts().then(() => {
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;
      const { w, h } = POST_SIZE[format];
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      const brand = { name: business.name, linkLabel, whatsapp: business.whatsapp, cover };
      const res =
        template === "turnos"
          ? renderAvailability(ctx, { format, theme, brand, days: availability })
          : template === "servicios"
          ? renderPrices(ctx, { format, theme, brand, groups: priceGroups })
          : renderBookOnline(ctx, { format, theme, brand });
      setDropped(res.dropped);
    });
    return () => {
      cancelled = true;
    };
  }, [template, format, theme, availability, priceGroups, cover, business.name, business.whatsapp, linkLabel, drawTick]);

  // Las letras pueden terminar de cargar después del primer dibujo.
  useEffect(() => {
    document.fonts?.ready.then(() => setDrawTick((t) => t + 1));
  }, []);

  const suggested = useMemo(() => {
    if (template === "turnos") {
      const lines = availability
        .map((d) => {
          const free = d.items.filter((i) => !i.taken).map((i) => i.time);
          const label = d.label.charAt(0) + d.label.slice(1).toLowerCase();
          return free.length ? `${label}: ${free.join(" · ")}` : `${label}: completo`;
        })
        .join("\n");
      return `📅 Turnos disponibles en ${business.name}\n\n${lines}\n\nReservá el tuyo acá 👉 ${link}`;
    }
    if (template === "servicios") {
      const lines = services.map((s) => `• ${s.name}: ${formatPrice(s.price)} (${formatDuration(s.durationMin)})`).join("\n");
      return `✨ Servicios de ${business.name}\n\n${lines}\n\nReservá tu turno online 👉 ${link}`;
    }
    return `¡Ahora podés sacar tu turno online en ${business.name}! 🗓️\nElegí el servicio, el día y el horario que te quede cómodo, a cualquier hora.\n\nReservá acá 👉 ${link}`;
  }, [template, availability, services, business.name, link]);

  const text = caption ?? suggested;

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  }

  async function copy(value: string, msg: string) {
    try {
      await navigator.clipboard.writeText(value);
      flash(msg);
    } catch {
      window.prompt("Copiá el texto:", value);
    }
  }

  function toBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) return resolve(null);
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });
  }

  const fileName = `${template}-${business.slug}.jpg`;

  async function download() {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function share() {
    const blob = await toBlob();
    if (!blob) return;
    const file = new File([blob], fileName, { type: "image/jpeg" });
    if (navigator.canShare?.({ files: [file] })) {
      // El texto se copia también: algunas apps (Instagram) no lo reciben al compartir.
      navigator.clipboard?.writeText(text).catch(() => undefined);
      try {
        await navigator.share({ files: [file], text });
      } catch (err) {
        // Cerrar el menú de compartir no es un error; cualquier otra falla, se descarga.
        if ((err as Error).name !== "AbortError") await download();
      }
    } else {
      await download();
      flash("Imagen descargada. Desde la compu, subila a Instagram o WhatsApp Web.");
    }
  }

  function changeTemplate(t: Template) {
    setTemplate(t);
    setCaption(null);
  }

  const optionBtn = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-semibold border ${
      active ? "bg-plum-900 border-plum-900 text-white" : "bg-white border-plum-200 text-plum-600"
    }`;

  return (
    <div className="space-y-6">
      {notice && (
        <p
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-plum-900 px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          {notice}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => changeTemplate(t.id)}
            aria-pressed={template === t.id}
            className={`card p-4 text-left transition-colors ${
              template === t.id ? "ring-2 ring-brand-600" : "hover:bg-plum-50"
            }`}
          >
            <p className="font-semibold text-plum-900">{t.title}</p>
            <p className="text-sm text-neutral-500">{t.text}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_1fr] gap-6 items-start">
        <div className="space-y-3">
          <canvas
            ref={canvasRef}
            className="w-full max-w-[340px] mx-auto rounded-2xl shadow-lg bg-plum-900"
            style={{ aspectRatio: `${POST_SIZE[format].w} / ${POST_SIZE[format].h}` }}
            aria-label="Vista previa de la imagen"
          />
          <div className="flex justify-center gap-2">
            <button className="btn-primary" onClick={share}>
              Compartir imagen
            </button>
            <button className="btn-secondary" onClick={download}>
              Descargar
            </button>
          </div>
          {loading && <p className="text-center text-sm text-neutral-500">Buscando horarios…</p>}
          {dropped > 0 && (
            <p className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
              {template === "turnos"
                ? `No entraron ${dropped} día(s). Probá con menos días o "cada 1 hora".`
                : `No entraron ${dropped} servicio(s). Probá el formato historia.`}
            </p>
          )}
        </div>

        <div className="space-y-5">
          <div className="card p-5 space-y-4">
            <div>
              <p className="label">Formato</p>
              <div className="flex flex-wrap gap-2">
                <button className={optionBtn(format === "story")} onClick={() => setFormat("story")}>
                  Historia / Estado
                </button>
                <button className={optionBtn(format === "post")} onClick={() => setFormat("post")}>
                  Publicación
                </button>
              </div>
            </div>
            <div>
              <p className="label">Fondo</p>
              <div className="flex flex-wrap gap-2">
                <button
                  className={optionBtn(theme === "photo")}
                  onClick={() => setTheme("photo")}
                  disabled={!business.coverUrl}
                  title={business.coverUrl ? undefined : "Subí una foto de portada en Mi negocio"}
                >
                  Foto de portada
                </button>
                <button className={optionBtn(theme === "plum")} onClick={() => setTheme("plum")}>
                  Ciruela
                </button>
                <button className={optionBtn(theme === "sand")} onClick={() => setTheme("sand")}>
                  Claro
                </button>
              </div>
              {!business.coverUrl && (
                <p className="text-xs text-neutral-400 mt-1">
                  Para usar tu foto de fondo, subí una portada en <a href="/panel/negocio" className="underline">Mi negocio</a>.
                </p>
              )}
            </div>

            {template === "turnos" && (
              <>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label" htmlFor="share-service">Servicio</label>
                    <select id="share-service" className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({formatDuration(s.durationMin)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="share-days">Días</label>
                    <select id="share-days" className="input" value={daysCount} onChange={(e) => setDaysCount(Number(e.target.value))}>
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <option key={n} value={n}>
                          Próximos {n} {n === 1 ? "día" : "días"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="share-step">Horarios</label>
                    <select id="share-step" className="input" value={step} onChange={(e) => setStep(Number(e.target.value) as 0 | 30 | 60)}>
                      <option value={60}>Cada 1 hora</option>
                      <option value={30}>Cada 30 min</option>
                      <option value={0}>Según la duración</option>
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-plum-700">
                  <input type="checkbox" checked={showTaken} onChange={(e) => setShowTaken(e.target.checked)} />
                  Mostrar tachados los horarios ocupados
                </label>

                {days && (
                  <div className="space-y-3">
                    <p className="text-xs text-neutral-500">
                      Tocá un horario para cambiarlo: <strong>libre</strong> → <span className="line-through">ocupado</span> →
                      oculto. Sirve si tomaste turnos por WhatsApp que no están en la agenda.
                    </p>
                    {days.length === 0 && <p className="text-sm text-neutral-500">No hay días con horarios disponibles.</p>}
                    {days.map((d) => {
                      const times = [...d.free, ...d.taken].sort();
                      return (
                        <div key={d.dateISO}>
                          <p className="text-sm font-semibold text-plum-900 mb-1">{dayLabel(d)}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {times.map((t) => {
                              const st = slotState(d, t);
                              return (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() =>
                                    setOverrides((o) => ({ ...o, [`${d.dateISO} ${t}`]: NEXT_STATE[st] }))
                                  }
                                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                                    st === "free"
                                      ? "border-plum-300 text-plum-900 bg-white"
                                      : st === "taken"
                                      ? "border-plum-100 text-plum-400 line-through bg-plum-50"
                                      : "border-dashed border-plum-200 text-plum-300 bg-white"
                                  }`}
                                  aria-label={`${t} ${st === "free" ? "libre" : st === "taken" ? "ocupado" : "oculto"}`}
                                >
                                  {t}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          </div>

          <div className="card p-5 space-y-3">
            <div className="flex flex-wrap gap-2">
              <a
                className="btn-secondary"
                href={`https://wa.me/?text=${encodeURIComponent(text)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Mandar texto por WhatsApp
              </a>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="share-text">Texto para acompañar</label>
                {caption !== null && (
                  <button className="text-xs font-semibold text-brand-600" onClick={() => setCaption(null)}>
                    Volver al sugerido
                  </button>
                )}
              </div>
              <textarea
                id="share-text"
                className="input min-h-[140px] text-sm"
                value={text}
                onChange={(e) => setCaption(e.target.value)}
              />
              <button className="text-sm font-semibold text-brand-600 mt-1" onClick={() => copy(text, "Texto copiado")}>
                Copiar texto
              </button>
            </div>

            <div className="rounded-lg bg-plum-50 p-3 text-sm text-plum-700 space-y-2">
              <p>
                <strong>Tu link de reserva:</strong>{" "}
                <a href={link} target="_blank" rel="noopener noreferrer" className="break-all underline">
                  {linkLabel}
                </a>{" "}
                <button className="font-semibold text-brand-600" onClick={() => copy(link, "Link copiado")}>
                  Copiar
                </button>
              </p>
              <p>
                <strong>En una historia de Instagram:</strong> subí la imagen, tocá el ícono de stickers → <em>Enlace</em> y
                pegá tu link. Así tus clientes tocan y van directo a reservar.
              </p>
              <p>
                <strong>En WhatsApp:</strong> compartí la imagen en tu estado o en un chat. El link del texto se puede tocar.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

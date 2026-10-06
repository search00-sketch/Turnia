// Dibuja en un <canvas> las imágenes para historias y publicaciones de
// Instagram / WhatsApp (sección Publicaciones del panel). Se arman en el
// navegador del negocio, así no consumen recursos del servidor. Los trazos
// "a lápiz" (óvalo del título, subrayados, tachados) usan un azar con semilla
// fija para que la imagen no cambie cada vez que se redibuja.

export type PostFormat = "story" | "post";
export type PostTheme = "photo" | "plum" | "sand";

export const POST_SIZE: Record<PostFormat, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  post: { w: 1080, h: 1350 },
};

export const POST_FONT = '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", system-ui, sans-serif';

export interface PostBrand {
  name: string;
  /** Link de reserva sin "https://", para mostrar. */
  linkLabel: string;
  whatsapp: string | null;
  cover: HTMLImageElement | null;
}

export interface AvailabilityDay {
  label: string; // "LUNES 05/10"
  items: { time: string; taken: boolean }[];
  full: boolean; // sin horarios libres: se muestra "Completo"
}

export interface PriceGroup {
  category: string;
  services: { name: string; price: string; duration: string }[];
}

/** Lo que no entró en la imagen, para avisarle al negocio. */
export interface RenderResult {
  dropped: number;
}

interface Palette {
  ink: string;
  muted: string;
  accent: string;
  faint: string;
}

const PALETTES: Record<"dark" | "light", Palette> = {
  dark: { ink: "#ffffff", muted: "rgba(255,255,255,0.72)", accent: "#f3a6c1", faint: "rgba(255,255,255,0.42)" },
  light: { ink: "#2a1830", muted: "#7d6577", accent: "#c8255a", faint: "rgba(42,24,48,0.38)" },
};

// ---------- azar con semilla y trazos a lápiz ----------

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
const jitter = (r: Rand, amount: number) => (r() - 0.5) * 2 * amount;

/** Línea hecha a mano: dos pasadas apenas desparejas. */
function pencilLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width: number, r: Rand) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  for (let pass = 0; pass < 2; pass++) {
    ctx.globalAlpha = pass === 0 ? 1 : 0.55;
    ctx.lineWidth = pass === 0 ? width : width * 0.55;
    const sag = jitter(r, width * 1.6);
    ctx.beginPath();
    ctx.moveTo(x1 + jitter(r, 4), y1 + jitter(r, width * 0.6));
    ctx.quadraticCurveTo((x1 + x2) / 2 + jitter(r, 20), (y1 + y2) / 2 + sag, x2 + jitter(r, 6), y2 + jitter(r, width * 0.6));
    ctx.stroke();
  }
  ctx.restore();
}

/** Óvalo a mano alrededor del título (da un poco más de una vuelta, como un trazo real). */
function pencilLoop(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string, width: number, r: Rand) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const start = -Math.PI * 0.62;
  const turns = Math.PI * 2 * 1.12;
  const steps = 40;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = start + (turns * i) / steps;
    const k = 1 + jitter(r, 0.03) + (i / steps) * 0.04; // se abre un poco al final
    pts.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k - (i / steps) * ry * 0.06]);
  }
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  ctx.stroke();
  ctx.restore();
}

/** Destello de cuatro puntas, como los dibujitos del sitio. */
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, r: Rand) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.09;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x + jitter(r, 2), y + jitter(r, 2), x, y + size);
  ctx.moveTo(x - size, y);
  ctx.quadraticCurveTo(x + jitter(r, 2), y + jitter(r, 2), x + size, y);
  ctx.stroke();
  ctx.restore();
}

/** Flecha a mano que apunta hacia abajo (al sticker de link en la historia). */
function pencilArrow(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, color: string, r: Rand) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 30, y);
  ctx.bezierCurveTo(x + 40, y + len * 0.3, x - 40, y + len * 0.6, x + jitter(r, 3), y + len);
  ctx.moveTo(x - 20, y + len - 26);
  ctx.lineTo(x, y + len + 2);
  ctx.lineTo(x + 24, y + len - 22);
  ctx.stroke();
  ctx.restore();
}

// ---------- texto ----------

function font(ctx: CanvasRenderingContext2D, weight: number, size: number, spacing = 0) {
  ctx.font = `${weight} ${Math.round(size)}px ${POST_FONT}`;
  // letterSpacing no existe en todos los navegadores: si falta, el texto sale sin espaciado.
  (ctx as unknown as { letterSpacing?: string }).letterSpacing = `${spacing}px`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Achica la letra hasta que el texto entre en el ancho. */
function fitText(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxWidth: number, spacing = 0) {
  let s = size;
  font(ctx, weight, s, spacing);
  while (ctx.measureText(text).width > maxWidth && s > 12) {
    s -= 1;
    font(ctx, weight, s, spacing);
  }
  return s;
}

// ---------- fondo, encabezado y pie ----------

function background(ctx: CanvasRenderingContext2D, W: number, H: number, theme: PostTheme, brand: PostBrand): Palette {
  if (theme === "sand") {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#f9f4ef");
    g.addColorStop(1, "#efe2d6");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return PALETTES.light;
  }

  if (theme === "photo" && brand.cover) {
    const img = brand.cover;
    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(42,24,48,0.62)");
    g.addColorStop(0.5, "rgba(42,24,48,0.70)");
    g.addColorStop(1, "rgba(42,24,48,0.86)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return PALETTES.dark;
  }

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#2a1830");
  g.addColorStop(1, "#4b2a47");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  return PALETTES.dark;
}

function decorate(ctx: CanvasRenderingContext2D, W: number, H: number, p: Palette, r: Rand) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  sparkle(ctx, W - 80, 80, 24, p.accent, r);
  sparkle(ctx, 48, H * 0.45, 14, p.accent, r);
  sparkle(ctx, W - 50, H * 0.72, 18, p.accent, r);
  ctx.restore();
}

/** Nombre del negocio arriba y título grande con el óvalo a lápiz. Devuelve dónde termina. */
function header(ctx: CanvasRenderingContext2D, W: number, top: number, brand: PostBrand, lines: string[], titleSize: number, p: Palette, r: Rand): number {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = p.muted;
  fitText(ctx, brand.name.toUpperCase(), 600, 34, W - 200, 6);
  ctx.fillText(brand.name.toUpperCase(), W / 2, top);

  const lineH = titleSize * 1.02;
  const titleTop = top + 100;
  let maxW = 0;
  ctx.fillStyle = p.ink;
  const size = Math.min(...lines.map((l) => fitText(ctx, l, 300, titleSize, W - 260, 2)));
  font(ctx, 300, size, 2);
  lines.forEach((l, i) => {
    maxW = Math.max(maxW, ctx.measureText(l).width);
    ctx.fillText(l, W / 2, titleTop + size * 0.85 + i * lineH);
  });
  const blockH = lineH * lines.length;
  pencilLoop(ctx, W / 2, titleTop + blockH / 2 - size * 0.05, maxW / 2 + 64, blockH / 2 + 26, p.accent, 5, r);
  return titleTop + blockH + 64;
}

/** Pie: link de reserva y WhatsApp. Devuelve dónde empieza (para no pisarlo). */
function footer(ctx: CanvasRenderingContext2D, W: number, H: number, format: PostFormat, brand: PostBrand, p: Palette, r: Rand, arrow: boolean): number {
  // En la historia, Instagram tapa los ~200px de abajo con "Responder".
  const bottom = format === "story" ? H - 230 : H - 70;
  const hasWa = Boolean(brand.whatsapp);
  const linkY = hasWa ? bottom - 52 : bottom;
  const labelY = linkY - 56;

  ctx.textAlign = "center";
  ctx.fillStyle = p.accent;
  font(ctx, 700, 28, 6);
  ctx.fillText("RESERVÁ ONLINE", W / 2, labelY);

  ctx.fillStyle = p.ink;
  fitText(ctx, brand.linkLabel, 600, 34, W - 140);
  ctx.fillText(brand.linkLabel, W / 2, linkY);

  if (hasWa) {
    ctx.fillStyle = p.muted;
    font(ctx, 500, 30, 1);
    ctx.fillText(`WhatsApp ${brand.whatsapp}`, W / 2, bottom);
  }

  if (arrow && format === "story") pencilArrow(ctx, W / 2 + 330, labelY - 120, 90, p.accent, r);
  return labelY - 70;
}

// ---------- plantillas ----------

export function renderAvailability(
  ctx: CanvasRenderingContext2D,
  opts: { format: PostFormat; theme: PostTheme; brand: PostBrand; days: AvailabilityDay[] }
): RenderResult {
  const { w: W, h: H } = POST_SIZE[opts.format];
  const r = rng(7);
  ctx.clearRect(0, 0, W, H);
  const p = background(ctx, W, H, opts.theme, opts.brand);
  decorate(ctx, W, H, p, r);

  const story = opts.format === "story";
  const top = header(ctx, W, story ? 150 : 100, opts.brand, ["TURNOS", "DISPONIBLES"], story ? 118 : 96, p, r);
  const limit = footer(ctx, W, H, opts.format, opts.brand, p, r, false);

  const base = story ? { day: 64, time: 52, row: 76, gap: 40, under: 26 } : { day: 50, time: 42, row: 60, gap: 26, under: 20 };
  const avail = limit - top;

  const layout = (days: AvailabilityDay[], cols: number) =>
    days.reduce((h, d) => h + base.day + base.under + Math.max(1, Math.ceil(d.items.length / cols)) * base.row + base.gap, 0);

  // 4 columnas cuando hay muchos horarios por día (ej: cada 30 min).
  const cols = Math.max(...opts.days.map((d) => d.items.length), 0) > 9 ? 4 : 3;
  let days = opts.days;
  let scale = 1;
  for (;;) {
    scale = Math.min(1, avail / layout(days, cols));
    if (scale >= 0.62 || days.length <= 1) break;
    days = days.slice(0, -1); // no entra: se corta el último día
  }
  scale = Math.max(scale, 0.45);

  const totalH = layout(days, cols) * scale;
  let y = top + Math.max(0, (avail - totalH) / 2.5);
  const colW = Math.min(300, (W - 160) / cols);
  ctx.textAlign = "center";

  for (const d of days) {
    // encabezado del día con subrayado
    ctx.fillStyle = p.ink;
    font(ctx, 400, base.day * scale, 3);
    const dayW = ctx.measureText(d.label).width;
    y += base.day * scale;
    ctx.fillText(d.label, W / 2, y);
    pencilLine(ctx, W / 2 - dayW / 2 - 24, y + 16 * scale, W / 2 + dayW / 2 + 24, y + 12 * scale, p.accent, 4.5 * scale, r);
    y += base.under * scale;

    if (d.items.length === 0) {
      ctx.fillStyle = p.muted;
      font(ctx, 500, base.time * scale);
      ctx.fillText("Completo", W / 2, y + base.row * scale * 0.72);
      y += base.row * scale + base.gap * scale;
      continue;
    }

    const rows = Math.ceil(d.items.length / cols);
    for (let row = 0; row < rows; row++) {
      const items = d.items.slice(row * cols, row * cols + cols);
      const rowW = items.length * colW;
      const baseY = y + base.row * scale * 0.72;
      items.forEach((it, i) => {
        const cx = W / 2 - rowW / 2 + colW * (i + 0.5);
        const label = `${it.time}hs`;
        font(ctx, it.taken ? 400 : 500, base.time * scale);
        ctx.fillStyle = it.taken ? p.faint : p.ink;
        ctx.fillText(label, cx, baseY);
        if (it.taken) {
          const tw = ctx.measureText(label).width;
          pencilLine(ctx, cx - tw / 2 - 10, baseY - base.time * scale * 0.28, cx + tw / 2 + 10, baseY - base.time * scale * 0.36, p.ink, 3.5 * scale, r);
        }
      });
      y += base.row * scale;
    }
    if (d.full) {
      ctx.fillStyle = p.accent;
      font(ctx, 700, base.time * scale * 0.6, 4);
      ctx.fillText("COMPLETO", W / 2, y + base.time * scale * 0.25);
    }
    y += base.gap * scale;
  }

  return { dropped: opts.days.length - days.length };
}

export function renderPrices(
  ctx: CanvasRenderingContext2D,
  opts: { format: PostFormat; theme: PostTheme; brand: PostBrand; groups: PriceGroup[] }
): RenderResult {
  const { w: W, h: H } = POST_SIZE[opts.format];
  const r = rng(11);
  ctx.clearRect(0, 0, W, H);
  const p = background(ctx, W, H, opts.theme, opts.brand);
  decorate(ctx, W, H, p, r);

  const story = opts.format === "story";
  const top = header(ctx, W, story ? 150 : 100, opts.brand, ["SERVICIOS"], story ? 120 : 100, p, r);
  const limit = footer(ctx, W, H, opts.format, opts.brand, p, r, false);
  const avail = limit - top;
  const base = story ? { cat: 34, name: 44, sub: 28, row: 118, catGap: 84 } : { cat: 28, name: 36, sub: 24, row: 96, catGap: 66 };

  const total = opts.groups.reduce((n, g) => n + g.services.length, 0);
  const height = (groups: PriceGroup[]) => groups.reduce((h, g) => h + base.catGap + g.services.length * base.row, 0);

  // Si no entra ni achicando, se cortan servicios del final.
  let groups = opts.groups;
  let scale = Math.min(1, avail / height(groups));
  while (scale < 0.6 && groups.length > 0) {
    const last = groups[groups.length - 1];
    groups = last.services.length > 1
      ? [...groups.slice(0, -1), { ...last, services: last.services.slice(0, -1) }]
      : groups.slice(0, -1);
    scale = Math.min(1, avail / height(groups));
  }
  const shown = groups.reduce((n, g) => n + g.services.length, 0);

  const left = 110;
  const right = W - 110;
  let y = top + Math.max(0, (avail - height(groups) * scale) / 2.5);

  for (const g of groups) {
    y += base.catGap * scale * 0.7;
    ctx.textAlign = "left";
    ctx.fillStyle = p.accent;
    font(ctx, 700, base.cat * scale, 5);
    const label = g.category.toUpperCase();
    ctx.fillText(label, left, y);
    const lw = ctx.measureText(label).width;
    pencilLine(ctx, left - 6, y + 14 * scale, left + lw + 16, y + 10 * scale, p.accent, 3.5 * scale, r);
    y += base.catGap * scale * 0.3;

    for (const s of g.services) {
      const nameY = y + base.name * scale;
      ctx.textAlign = "right";
      ctx.fillStyle = p.ink;
      font(ctx, 700, base.name * scale);
      ctx.fillText(s.price, right, nameY);
      const priceW = ctx.measureText(s.price).width;

      ctx.textAlign = "left";
      font(ctx, 500, base.name * scale);
      let name = s.name;
      const maxName = right - left - priceW - 50;
      while (ctx.measureText(name).width > maxName && name.length > 4) name = name.slice(0, -2) + "…";
      ctx.fillText(name, left, nameY);

      // puntitos entre el nombre y el precio
      const from = left + ctx.measureText(name).width + 18;
      const to = right - priceW - 18;
      ctx.fillStyle = p.faint;
      for (let x = from; x < to; x += 16 * scale) ctx.fillRect(x, nameY - 8 * scale, 4 * scale, 4 * scale);

      ctx.fillStyle = p.muted;
      font(ctx, 500, base.sub * scale);
      ctx.fillText(s.duration, left, nameY + base.sub * scale * 1.35);
      y += base.row * scale;
    }
  }

  return { dropped: total - shown };
}

export function renderBookOnline(
  ctx: CanvasRenderingContext2D,
  opts: { format: PostFormat; theme: PostTheme; brand: PostBrand }
): RenderResult {
  const { w: W, h: H } = POST_SIZE[opts.format];
  const r = rng(23);
  ctx.clearRect(0, 0, W, H);
  const p = background(ctx, W, H, opts.theme, opts.brand);
  decorate(ctx, W, H, p, r);

  const story = opts.format === "story";
  let y = header(ctx, W, story ? 190 : 110, opts.brand, ["RESERVÁ", "TU TURNO"], story ? 124 : 100, p, r);

  // "online" grande en el color de acento, con subrayado
  ctx.textAlign = "center";
  ctx.fillStyle = p.accent;
  font(ctx, 800, story ? 110 : 84, 1);
  y += story ? 70 : 40;
  ctx.fillText("online", W / 2, y);
  const ow = ctx.measureText("online").width;
  pencilLine(ctx, W / 2 - ow / 2 - 10, y + 26, W / 2 + ow / 2 + 20, y + 20, p.accent, 6, r);

  ctx.fillStyle = p.muted;
  font(ctx, 500, story ? 40 : 34);
  y += story ? 110 : 80;
  for (const line of wrap(ctx, "Elegí el servicio, el día y el horario que te quede cómodo. Las 24 hs, en un minuto.", W - 240)) {
    ctx.fillText(line, W / 2, y);
    y += story ? 56 : 46;
  }

  const steps = ["Elegí el servicio", "Elegí día y horario", "¡Listo! Te llega la confirmación"];
  const stepH = story ? 128 : 92;
  const limit = footer(ctx, W, H, opts.format, opts.brand, p, r, true);
  y = Math.max(y + (story ? 60 : 30), y + (limit - y - steps.length * stepH) / 2);
  const left = story ? 170 : 150;
  steps.forEach((s, i) => {
    const cy = y + i * stepH;
    pencilLoop(ctx, left, cy, story ? 40 : 32, story ? 38 : 30, p.accent, 3.5, r);
    ctx.textAlign = "center";
    ctx.fillStyle = p.ink;
    font(ctx, 700, story ? 44 : 36);
    ctx.fillText(String(i + 1), left, cy + (story ? 16 : 13));
    ctx.textAlign = "left";
    font(ctx, 600, story ? 44 : 36);
    fitText(ctx, s, 600, story ? 44 : 36, W - left - 160);
    ctx.fillText(s, left + (story ? 80 : 66), cy + (story ? 15 : 12));
  });

  return { dropped: 0 };
}

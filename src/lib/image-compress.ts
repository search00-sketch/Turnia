// Achica una foto en el navegador antes de subirla: la recorta al formato
// pedido (como "cover" en CSS), la redimensiona y baja la calidad hasta que
// pese menos de maxBytes. Devuelve un data URL (base64) listo para guardar.

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No pudimos leer esa imagen. Probá con una foto JPG o PNG."));
    };
    img.src = url;
  });
}

function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor((base64.length * 3) / 4);
}

export async function compressImage(
  file: File,
  { width, height, maxBytes }: { width: number; height: number; maxBytes: number }
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("El archivo no es una imagen.");
  const img = await loadImage(file);

  // Recorte centrado para llenar width x height sin deformar.
  const targetRatio = width / height;
  const srcRatio = img.naturalWidth / img.naturalHeight;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (srcRatio > targetRatio) sw = sh * targetRatio;
  else sh = sw / targetRatio;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;

  let scale = Math.min(1, width / sw);
  for (let attempt = 0; attempt < 4; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; // fondo blanco para PNG con transparencia
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.8, 0.7, 0.6, 0.5, 0.4]) {
      let dataUrl = canvas.toDataURL("image/webp", quality);
      // Safari viejo no genera WebP: devuelve PNG. En ese caso, JPG.
      if (!dataUrl.startsWith("data:image/webp")) dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrlBytes(dataUrl) <= maxBytes) return dataUrl;
    }
    scale *= 0.75; // sigue pesada: más chica
  }
  throw new Error("No pudimos achicar la imagen lo suficiente. Probá con otra foto.");
}

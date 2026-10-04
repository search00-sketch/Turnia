import { getImage } from "@/lib/db/images";

export const dynamic = "force-dynamic";

// Sirve una foto guardada en Firestore. Cada foto tiene un id propio que no
// cambia (una foto nueva es otro id), así que se puede cachear para siempre:
// Vercel la guarda en su CDN y Firestore se lee una sola vez por foto.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!/^[A-Za-z0-9]{1,64}$/.test(params.id)) return new Response("Not found", { status: 404 });

  const image = await getImage(params.id);
  if (!image) return new Response("Not found", { status: 404 });

  return new Response(Buffer.from(image.data, "base64"), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  });
}

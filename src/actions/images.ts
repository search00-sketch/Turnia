"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessUser } from "@/lib/session";
import { updateBusiness } from "@/lib/db/businesses";
import { getProfessionalById, updateProfessional } from "@/lib/db/professionals";
import {
  MAX_IMAGE_BYTES,
  deleteImageOfBusiness,
  imageIdFromUrl,
  imageUrl,
  parseImageDataUrl,
  saveImage,
  type ImageKind,
} from "@/lib/db/images";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Guarda la foto nueva (o ninguna, con null) y devuelve su URL. */
async function storeImage(
  businessId: string,
  kind: ImageKind,
  dataUrl: string | null
): Promise<{ ok: true; url: string | null } | { ok: false; error: string }> {
  if (dataUrl === null) return { ok: true, url: null };
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) return { ok: false, error: "La imagen no es válida. Probá con una foto JPG o PNG." };
  if (parsed.bytes > MAX_IMAGE_BYTES) return { ok: false, error: "La imagen es demasiado pesada." };
  const id = await saveImage({ businessId, kind, contentType: parsed.contentType, data: parsed.data });
  return { ok: true, url: imageUrl(id) };
}

function revalidateBusiness(slug: string) {
  revalidatePath("/panel", "layout");
  revalidatePath("/");
  revalidatePath("/negocios");
  revalidatePath(`/negocios/${slug}`);
}

export async function setBusinessCover(dataUrl: string | null): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };
  const business = user.business!;

  const stored = await storeImage(business.id, "cover", dataUrl);
  if (!stored.ok) return stored;

  await updateBusiness(business.id, { coverImage: stored.url });
  const previousId = imageIdFromUrl(business.coverImage);
  if (previousId) await deleteImageOfBusiness(previousId, business.id);

  revalidateBusiness(business.slug);
  return { ok: true };
}

export async function setProfessionalPhoto(professionalId: string, dataUrl: string | null): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };
  const business = user.business!;

  const professional = await getProfessionalById(professionalId);
  if (!professional || professional.businessId !== business.id) {
    return { ok: false, error: "No encontramos ese profesional." };
  }

  const stored = await storeImage(business.id, "professional", dataUrl);
  if (!stored.ok) return stored;

  await updateProfessional(professionalId, { photo: stored.url });
  const previousId = imageIdFromUrl(professional.photo);
  if (previousId) await deleteImageOfBusiness(previousId, business.id);

  revalidateBusiness(business.slug);
  return { ok: true };
}

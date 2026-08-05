"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/session";
import { updateBusiness } from "@/lib/db/businesses";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function adminSetBusinessPublished(
  businessId: string,
  published: boolean
): Promise<ActionResult> {
  const admin = await requireAdminUser();
  if (!admin) return { ok: false, error: "AUTH_REQUIRED" };

  await updateBusiness(businessId, { published });
  revalidatePath("/admin/negocios");
  revalidatePath("/negocios");
  return { ok: true };
}

const paidUntilSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
  .nullable();

export async function adminSetBusinessPaidUntil(
  businessId: string,
  paidUntilISO: string | null
): Promise<ActionResult> {
  const admin = await requireAdminUser();
  if (!admin) return { ok: false, error: "AUTH_REQUIRED" };

  const parsed = paidUntilSchema.safeParse(paidUntilISO);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Fecha inválida" };
  }

  const paidUntil = parsed.data ? new Date(`${parsed.data}T00:00:00`) : null;
  await updateBusiness(businessId, { paidUntil });
  revalidatePath("/admin/negocios");
  return { ok: true };
}

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  createService as createServiceDoc,
  updateService as updateServiceDoc,
  getServiceById,
} from "@/lib/db/services";
import { requireBusinessUser } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const serviceSchema = z.object({
  category: z.string().min(1, "Ingresá una categoría"),
  name: z.string().min(1, "Ingresá un nombre"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "El precio no puede ser negativo"),
  durationMin: z.coerce.number().int().min(5, "La duración mínima es 5 minutos"),
});

export async function createService(input: unknown): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  await createServiceDoc(user.business!.id, parsed.data);

  revalidatePath("/panel/servicios");
  revalidatePath("/negocios");
  return { ok: true };
}

export async function updateService(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const existing = await getServiceById(id);
  if (!existing || existing.businessId !== user.business!.id) {
    return { ok: false, error: "No encontramos ese servicio." };
  }

  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  await updateServiceDoc(id, parsed.data);
  revalidatePath("/panel/servicios");
  revalidatePath("/negocios");
  return { ok: true };
}

export async function setServiceActive(id: string, active: boolean): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const existing = await getServiceById(id);
  if (!existing || existing.businessId !== user.business!.id) {
    return { ok: false, error: "No encontramos ese servicio." };
  }

  await updateServiceDoc(id, { active });
  revalidatePath("/panel/servicios");
  revalidatePath("/negocios");
  return { ok: true };
}

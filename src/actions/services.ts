"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
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

  await prisma.service.create({
    data: { ...parsed.data, businessId: user.business!.id },
  });

  revalidatePath("/panel/servicios");
  revalidatePath("/negocios");
  return { ok: true };
}

export async function updateService(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing || existing.businessId !== user.business!.id) {
    return { ok: false, error: "No encontramos ese servicio." };
  }

  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  await prisma.service.update({ where: { id }, data: parsed.data });
  revalidatePath("/panel/servicios");
  revalidatePath("/negocios");
  return { ok: true };
}

export async function setServiceActive(id: string, active: boolean): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing || existing.businessId !== user.business!.id) {
    return { ok: false, error: "No encontramos ese servicio." };
  }

  await prisma.service.update({ where: { id }, data: { active } });
  revalidatePath("/panel/servicios");
  revalidatePath("/negocios");
  return { ok: true };
}

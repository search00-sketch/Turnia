"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { upsertHours } from "@/lib/db/hours";
import { requireBusinessUser } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const hourSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isClosed: z.boolean(),
  openTime: z.string().nullable(),
  closeTime: z.string().nullable(),
});

const hoursSchema = z.array(hourSchema).length(7);

export async function updateBusinessHours(input: unknown): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const parsed = hoursSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos de horario inválidos." };

  for (const day of parsed.data) {
    if (!day.isClosed && (!day.openTime || !day.closeTime)) {
      return { ok: false, error: "Completá el horario de apertura y cierre de todos los días abiertos." };
    }
    if (!day.isClosed && day.openTime! >= day.closeTime!) {
      return { ok: false, error: "El horario de cierre debe ser posterior al de apertura." };
    }
  }

  await upsertHours(user.business!.id, parsed.data);

  revalidatePath("/panel/horarios");
  revalidatePath("/negocios");
  return { ok: true };
}

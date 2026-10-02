"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  createMovement as createMovementDoc,
  deleteMovement as deleteMovementDoc,
  getMovementById,
} from "@/lib/db/movements";
import { getServiceById } from "@/lib/db/services";
import { requireBusinessUser } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const movementSchema = z.object({
  type: z.enum(["INGRESO", "GASTO"], { message: "Elegí si es un ingreso o un gasto" }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ingresá una fecha válida"),
  amount: z.coerce.number().positive("El monto tiene que ser mayor a 0"),
  concept: z.string().trim().min(1, "Ingresá un concepto").max(80, "El concepto es demasiado largo"),
  serviceId: z.string().optional(),
  notes: z.string().trim().max(300, "La nota es demasiado larga").optional(),
});

export async function createMovement(input: unknown): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const serviceId = parsed.data.serviceId || null;
  if (serviceId) {
    const service = await getServiceById(serviceId);
    if (!service || service.businessId !== user.business!.id) {
      return { ok: false, error: "No encontramos ese servicio." };
    }
  }

  // Mediodía local: así la fecha no se corre de día por diferencias de zona horaria.
  const date = new Date(`${parsed.data.date}T12:00:00`);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Ingresá una fecha válida" };

  await createMovementDoc(user.business!.id, {
    type: parsed.data.type,
    date,
    amount: parsed.data.amount,
    concept: parsed.data.concept,
    serviceId,
    notes: parsed.data.notes || null,
  });

  revalidatePath("/panel/contabilidad");
  return { ok: true };
}

export async function deleteMovement(id: string): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const existing = await getMovementById(id);
  if (!existing || existing.businessId !== user.business!.id) {
    return { ok: false, error: "No encontramos ese movimiento." };
  }

  await deleteMovementDoc(id);
  revalidatePath("/panel/contabilidad");
  return { ok: true };
}

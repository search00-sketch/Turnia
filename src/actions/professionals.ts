"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  createProfessional as createProfessionalDoc,
  updateProfessional as updateProfessionalDoc,
  getProfessionalById,
} from "@/lib/db/professionals";
import { requireBusinessUser } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const professionalSchema = z.object({
  name: z.string().min(1, "Ingresá un nombre"),
});

export async function createProfessional(input: unknown): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const parsed = professionalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  await createProfessionalDoc(user.business!.id, parsed.data);

  revalidatePath("/panel/profesionales");
  return { ok: true };
}

export async function updateProfessional(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const existing = await getProfessionalById(id);
  if (!existing || existing.businessId !== user.business!.id) {
    return { ok: false, error: "No encontramos ese profesional." };
  }

  const parsed = professionalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  await updateProfessionalDoc(id, parsed.data);
  revalidatePath("/panel/profesionales");
  return { ok: true };
}

export async function setProfessionalActive(id: string, active: boolean): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const existing = await getProfessionalById(id);
  if (!existing || existing.businessId !== user.business!.id) {
    return { ok: false, error: "No encontramos ese profesional." };
  }

  await updateProfessionalDoc(id, { active });
  revalidatePath("/panel/profesionales");
  return { ok: true };
}

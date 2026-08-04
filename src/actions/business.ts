"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireBusinessUser } from "@/lib/session";
import { CATEGORIES } from "@/lib/config";

export type ActionResult = { ok: true } | { ok: false; error: string };

const profileSchema = z.object({
  name: z.string().min(2, "Ingresá el nombre del negocio"),
  category: z.enum(CATEGORIES.map((c) => c.slug) as [string, ...string[]]),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  coverImage: z.string().optional(),
  published: z.boolean(),
});

export async function updateBusinessProfile(input: unknown): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  await prisma.business.update({
    where: { id: user.business!.id },
    data: parsed.data,
  });

  revalidatePath("/panel/negocio");
  revalidatePath("/negocios");
  revalidatePath(`/negocios/${user.business!.slug}`);
  return { ok: true };
}

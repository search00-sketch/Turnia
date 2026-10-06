"use server";

import { z } from "zod";
import { requireBusinessUser } from "@/lib/session";
import { getServiceById } from "@/lib/db/services";
import { getShareAvailability, type ShareDay } from "@/lib/share-availability";

const schema = z.object({
  serviceId: z.string().min(1),
  /** Cada cuántos minutos mostrar horarios: 30, 60 o 0 = la duración del servicio. */
  step: z.union([z.literal(0), z.literal(30), z.literal(60)]),
  days: z.number().int().min(1).max(7),
});

export async function getAvailabilityForPost(
  input: z.infer<typeof schema>
): Promise<{ ok: true; days: ShareDay[] } | { ok: false; error: string }> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const service = await getServiceById(parsed.data.serviceId);
  if (!service || service.businessId !== user.business!.id) {
    return { ok: false, error: "No encontramos ese servicio." };
  }

  const stepMinutes = parsed.data.step || service.durationMin;
  const days = await getShareAvailability(user.business!.id, {
    durationMin: service.durationMin,
    stepMinutes,
    days: parsed.data.days,
  });
  return { ok: true, days };
}

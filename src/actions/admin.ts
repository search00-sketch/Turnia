"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/session";
import { updateBusiness } from "@/lib/db/businesses";
import { applyTimezoneFix } from "@/lib/db/timezoneFix";
import { deleteBusinessCascade } from "@/lib/db/deleteBusiness";
import { getBusinessById } from "@/lib/db/businesses";
import { getUserByUid } from "@/lib/db/users";
import { sendUserMail, appointmentCancelledClientEmail } from "@/lib/mailer";
import { formatDateLong, formatTime } from "@/lib/format";

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

export async function adminApplyTimezoneFix(
  appointmentIds: string[]
): Promise<{ ok: true; appointments: number; paidUntil: number } | { ok: false; error: string }> {
  const admin = await requireAdminUser();
  if (!admin) return { ok: false, error: "AUTH_REQUIRED" };

  const ids = z.array(z.string().min(1)).max(5000).safeParse(appointmentIds);
  if (!ids.success) return { ok: false, error: "Datos inválidos" };

  const result = await applyTimezoneFix(ids.data);
  revalidatePath("/admin/zona-horaria");
  revalidatePath("/admin/negocios");
  revalidatePath("/panel", "layout");
  revalidatePath("/mis-turnos");
  return { ok: true, ...result };
}

/**
 * Borra un negocio con todos sus datos (ver deleteBusinessCascade). Para
 * evitar accidentes hay que escribir el nombre del negocio. A los clientes
 * con turnos futuros se les avisa por mail que su turno se canceló.
 */
export async function adminDeleteBusiness(businessId: string, confirmName: string): Promise<ActionResult> {
  const admin = await requireAdminUser();
  if (!admin) return { ok: false, error: "AUTH_REQUIRED" };

  const business = await getBusinessById(businessId);
  if (!business) return { ok: false, error: "Ese negocio ya no existe." };
  const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  if (normalize(confirmName) !== normalize(business.name)) {
    return { ok: false, error: "El nombre no coincide. Escribilo igual que figura en la lista." };
  }

  const result = await deleteBusinessCascade(businessId);
  if (!result) return { ok: false, error: "Ese negocio ya no existe." };

  for (const appointment of result.cancelledUpcoming) {
    try {
      const client = await getUserByUid(appointment.clientId);
      if (!client) continue;
      await sendUserMail({
        user: client,
        subject: `Tu turno en ${business.name} fue cancelado`,
        html: appointmentCancelledClientEmail({
          clientName: client.name,
          businessName: business.name,
          businessSlug: business.slug,
          serviceName: result.serviceNames[appointment.serviceId] || "—",
          dateLabel: formatDateLong(appointment.startsAt),
          timeLabel: formatTime(appointment.startsAt),
          byBusiness: true,
          businessClosed: true,
        }),
      });
    } catch (err) {
      console.error("No se pudo avisar la cancelación por baja del negocio", err);
    }
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/negocios");
  revalidatePath("/");
  revalidatePath("/mis-turnos");
  return { ok: true };
}

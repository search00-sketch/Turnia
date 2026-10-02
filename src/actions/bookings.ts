"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireBusinessUser } from "@/lib/session";
import { getUserByUid } from "@/lib/db/users";
import { getBusinessById } from "@/lib/db/businesses";
import { getHoursByBusiness } from "@/lib/db/hours";
import { getProfessionalsByBusiness } from "@/lib/db/professionals";
import { getServiceById } from "@/lib/db/services";
import {
  getAppointmentsInRange,
  getAppointmentById,
  createAppointmentTx,
  reactivateAppointmentTx,
  updateAppointmentStatus,
  SlotUnavailableError,
} from "@/lib/db/appointments";
import { generateAvailableSlots } from "@/lib/slots";
import { sendMail, bookingConfirmationEmail, newBookingOwnerEmail } from "@/lib/mailer";
import { formatDateLong, formatTime } from "@/lib/format";

export type ActionResult = { ok: true } | { ok: false; error: string };

function dayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Devuelve, para un negocio/servicio/fecha dados, los horarios libres por profesional. */
export async function getAvailableSlots({
  businessId,
  serviceId,
  professionalId,
  dateISO,
}: {
  businessId: string;
  serviceId: string;
  professionalId: string; // "any" o el id de un profesional puntual
  dateISO: string; // "yyyy-MM-dd"
}) {
  const [business, service, businessHours, allProfessionals] = await Promise.all([
    getBusinessById(businessId),
    getServiceById(serviceId),
    getHoursByBusiness(businessId),
    getProfessionalsByBusiness(businessId, { activeOnly: true }),
  ]);

  if (!business || !service) {
    return { professionals: [] as { id: string; name: string }[], slotsByProfessional: {} as Record<string, string[]> };
  }

  const date = new Date(`${dateISO}T00:00:00`);
  const candidates =
    professionalId === "any"
      ? allProfessionals
      : allProfessionals.filter((p) => p.id === professionalId);

  const { start, end } = dayRange(date);
  const appointments = await getAppointmentsInRange(businessId, start, end);
  const relevant = appointments.filter((a) => a.status === "PENDIENTE" || a.status === "CONFIRMADO");

  const slotsByProfessional: Record<string, string[]> = {};
  for (const prof of candidates) {
    const busy = relevant.filter((a) => a.professionalId === prof.id);
    const slots = generateAvailableSlots({
      date,
      durationMin: service.durationMin,
      businessHours,
      busyRanges: busy,
    });
    slotsByProfessional[prof.id] = slots.map(
      (s) => `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`
    );
  }

  return {
    professionals: candidates.map((p) => ({ id: p.id, name: p.name })),
    slotsByProfessional,
  };
}

/** Crea el turno, revalidando disponibilidad en una transacción de Firestore para evitar choques. */
export async function createAppointment(input: {
  businessId: string;
  serviceId: string;
  professionalId: string;
  dateISO: string;
  time: string;
  notes?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "AUTH_REQUIRED" };
  }
  if (user.role !== "CLIENTE") {
    return { ok: false, error: "Ingresá con una cuenta de cliente para reservar." };
  }

  const [business, service, businessHours, allProfessionals] = await Promise.all([
    getBusinessById(input.businessId),
    getServiceById(input.serviceId),
    getHoursByBusiness(input.businessId),
    getProfessionalsByBusiness(input.businessId, { activeOnly: true }),
  ]);

  if (!business || !service) {
    return { ok: false, error: "No encontramos el negocio o el servicio." };
  }

  const owner = await getUserByUid(business.ownerId);
  if (!owner) {
    return { ok: false, error: "No encontramos el negocio o el servicio." };
  }

  const date = new Date(`${input.dateISO}T00:00:00`);
  const [hh, mm] = input.time.split(":").map(Number);
  const startsAt = new Date(date);
  startsAt.setHours(hh, mm, 0, 0);
  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60000);

  const candidates =
    input.professionalId === "any"
      ? allProfessionals
      : allProfessionals.filter((p) => p.id === input.professionalId);

  if (candidates.length === 0) {
    return { ok: false, error: "No hay profesionales disponibles para ese servicio." };
  }

  const { start, end } = dayRange(date);
  const existing = await getAppointmentsInRange(input.businessId, start, end);
  const relevant = existing.filter((a) => a.status === "PENDIENTE" || a.status === "CONFIRMADO");

  let chosenProfessional: { id: string; name: string } | null = null;
  for (const prof of candidates) {
    const busy = relevant.filter((a) => a.professionalId === prof.id);
    const slots = generateAvailableSlots({
      date,
      durationMin: service.durationMin,
      businessHours,
      busyRanges: busy,
    });
    if (slots.some((s) => s.getTime() === startsAt.getTime())) {
      chosenProfessional = prof;
      break;
    }
  }

  if (!chosenProfessional) {
    return { ok: false, error: "Ese horario ya no está disponible. Elegí otro." };
  }

  try {
    await createAppointmentTx({
      businessId: business.id,
      professionalId: chosenProfessional.id,
      serviceId: service.id,
      clientId: user.id,
      startsAt,
      endsAt,
      durationMin: service.durationMin,
      businessHours,
      notes: input.notes,
      price: service.price,
      cost: service.cost,
    });
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      return { ok: false, error: "Ese horario ya no está disponible. Elegí otro." };
    }
    throw err;
  }

  try {
    await sendMail({
      to: user.email,
      subject: `Turno confirmado en ${business.name}`,
      html: bookingConfirmationEmail({
        clientName: user.name,
        businessName: business.name,
        serviceName: service.name,
        professionalName: chosenProfessional.name,
        dateLabel: formatDateLong(startsAt),
        timeLabel: formatTime(startsAt),
        address: business.address,
      }),
    });

    await sendMail({
      to: owner.email,
      subject: `Nuevo turno de ${user.name}`,
      html: newBookingOwnerEmail({
        businessName: business.name,
        clientName: user.name,
        serviceName: service.name,
        professionalName: chosenProfessional.name,
        dateLabel: formatDateLong(startsAt),
        timeLabel: formatTime(startsAt),
      }),
    });
  } catch (err) {
    console.error("No se pudo enviar el email de confirmación", err);
  }

  revalidatePath("/mis-turnos");
  revalidatePath("/panel/agenda");
  revalidatePath("/panel/contabilidad");

  return { ok: true };
}

export async function cancelAppointmentAsClient(appointmentId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const appointment = await getAppointmentById(appointmentId);
  if (!appointment || appointment.clientId !== user.id) {
    return { ok: false, error: "No encontramos ese turno." };
  }
  if (appointment.status !== "PENDIENTE" && appointment.status !== "CONFIRMADO") {
    return { ok: false, error: "Este turno ya no se puede cancelar." };
  }
  if (appointment.startsAt < new Date()) {
    return { ok: false, error: "No se puede cancelar un turno que ya pasó." };
  }

  await updateAppointmentStatus(appointmentId, "CANCELADO");

  revalidatePath("/mis-turnos");
  revalidatePath("/panel/agenda");
  revalidatePath("/panel/contabilidad");
  return { ok: true };
}

export async function updateAppointmentStatusAsBusiness(
  appointmentId: string,
  status: "CONFIRMADO" | "CANCELADO" | "COMPLETADO"
): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) {
    return { ok: false, error: "AUTH_REQUIRED" };
  }

  const appointment = await getAppointmentById(appointmentId);
  if (!appointment || appointment.businessId !== user.business!.id) {
    return { ok: false, error: "No encontramos ese turno." };
  }

  if (status === "CONFIRMADO" && appointment.status === "CANCELADO") {
    try {
      await reactivateAppointmentTx(appointmentId);
    } catch (err) {
      if (err instanceof SlotUnavailableError) return { ok: false, error: err.message };
      throw err;
    }
  } else {
    await updateAppointmentStatus(appointmentId, status);
  }

  revalidatePath("/panel/agenda");
  revalidatePath("/mis-turnos");
  revalidatePath("/panel/contabilidad");
  return { ok: true };
}

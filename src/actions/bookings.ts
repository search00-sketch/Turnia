"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireBusinessUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
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
  const [business, service] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      include: { hours: true, professionals: { where: { active: true } } },
    }),
    prisma.service.findUnique({ where: { id: serviceId } }),
  ]);

  if (!business || !service) {
    return { professionals: [] as { id: string; name: string }[], slotsByProfessional: {} as Record<string, string[]> };
  }

  const businessHours = business.hours ?? [];
  const allProfessionals = business.professionals ?? [];

  const date = new Date(`${dateISO}T00:00:00`);
  const candidates =
    professionalId === "any"
      ? allProfessionals
      : allProfessionals.filter((p) => p.id === professionalId);

  const { start, end } = dayRange(date);
  const appointments = await prisma.appointment.findMany({
    where: {
      businessId,
      status: { in: ["PENDIENTE", "CONFIRMADO"] },
      startsAt: { gte: start, lte: end },
      professionalId: { in: candidates.map((p) => p.id) },
    },
    select: { professionalId: true, startsAt: true, endsAt: true },
  });

  const slotsByProfessional: Record<string, string[]> = {};
  for (const prof of candidates) {
    const busy = appointments.filter((a) => a.professionalId === prof.id);
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

/** Crea el turno, revalidando disponibilidad en el servidor para evitar choques. */
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

  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    include: { hours: true, professionals: { where: { active: true } }, owner: true },
  });
  const service = await prisma.service.findUnique({ where: { id: input.serviceId } });

  if (!business || !service || !business.owner) {
    return { ok: false, error: "No encontramos el negocio o el servicio." };
  }

  const owner = business.owner;
  const businessHours = business.hours ?? [];
  const allProfessionals = business.professionals ?? [];

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
  const existing = await prisma.appointment.findMany({
    where: {
      businessId: business.id,
      status: { in: ["PENDIENTE", "CONFIRMADO"] },
      startsAt: { gte: start, lte: end },
      professionalId: { in: candidates.map((p) => p.id) },
    },
  });

  let chosenProfessional: { id: string; name: string } | null = null;
  for (const prof of candidates) {
    const busy = existing.filter((a) => a.professionalId === prof.id);
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

  const appointment = await prisma.appointment.create({
    data: {
      businessId: business.id,
      professionalId: chosenProfessional.id,
      serviceId: service.id,
      clientId: user.id,
      startsAt,
      endsAt,
      status: "CONFIRMADO",
      notes: input.notes,
    },
    include: { client: true },
  });

  // El cliente siempre viene incluido porque se pidió explícitamente arriba.
  const client = appointment.client!;

  try {
    await sendMail({
      to: client.email,
      subject: `Turno confirmado en ${business.name}`,
      html: bookingConfirmationEmail({
        clientName: client.name,
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
      subject: `Nuevo turno de ${client.name}`,
      html: newBookingOwnerEmail({
        businessName: business.name,
        clientName: client.name,
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

  return { ok: true };
}

export async function cancelAppointmentAsClient(appointmentId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment || appointment.clientId !== user.id) {
    return { ok: false, error: "No encontramos ese turno." };
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CANCELADO" },
  });

  revalidatePath("/mis-turnos");
  revalidatePath("/panel/agenda");
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

  const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appointment || appointment.businessId !== user.business!.id) {
    return { ok: false, error: "No encontramos ese turno." };
  }

  await prisma.appointment.update({ where: { id: appointmentId }, data: { status } });

  revalidatePath("/panel/agenda");
  revalidatePath("/mis-turnos");
  return { ok: true };
}

import { prisma } from "./prisma";
import { sendMail, bookingReminderEmail } from "./mailer";
import { formatDateLong, formatTime } from "./format";
import { REMINDER_HOURS_BEFORE } from "./config";

/**
 * Busca turnos que empiezan dentro de la ventana de recordatorio
 * (por defecto, entre 23 y 25 horas antes) y a los que todavía no
 * se les envió el recordatorio, y les manda el email correspondiente.
 *
 * Pensado para ejecutarse periódicamente (cada 1 hora aprox.) desde
 * /api/cron/reminders o desde scripts/send-reminders.ts.
 */
export async function sendDueReminders() {
  const now = new Date();
  const windowStart = new Date(now.getTime() + (REMINDER_HOURS_BEFORE - 1) * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + (REMINDER_HOURS_BEFORE + 1) * 60 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      status: { in: ["CONFIRMADO", "PENDIENTE"] },
      reminderSent: false,
      startsAt: { gte: windowStart, lte: windowEnd },
    },
    include: { client: true, business: true, service: true },
  });

  let sent = 0;
  for (const appt of appointments) {
    // client/business/service siempre vienen incluidos por el include de arriba.
    const client = appt.client!;
    const business = appt.business!;
    const service = appt.service!;
    try {
      await sendMail({
        to: client.email,
        subject: `Recordatorio de tu turno en ${business.name}`,
        html: bookingReminderEmail({
          clientName: client.name,
          businessName: business.name,
          serviceName: service.name,
          dateLabel: formatDateLong(appt.startsAt),
          timeLabel: formatTime(appt.startsAt),
          address: business.address,
        }),
      });
      await prisma.appointment.update({ where: { id: appt.id }, data: { reminderSent: true } });
      sent++;
    } catch (err) {
      console.error(`No se pudo enviar el recordatorio del turno ${appt.id}`, err);
    }
  }

  return { checked: appointments.length, sent };
}

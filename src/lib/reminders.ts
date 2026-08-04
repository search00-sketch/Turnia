import { getDueReminders, markReminderSent } from "./db/appointments";
import { getBusinessById } from "./db/businesses";
import { getServiceById } from "./db/services";
import { getUserByUid } from "./db/users";
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

  const appointments = await getDueReminders(windowStart, windowEnd);

  let sent = 0;
  for (const appt of appointments) {
    const [client, business, service] = await Promise.all([
      getUserByUid(appt.clientId),
      getBusinessById(appt.businessId),
      getServiceById(appt.serviceId),
    ]);
    // Firestore no tiene foreign keys: si alguno de los tres fue borrado, se
    // salta el recordatorio en vez de romper el resto de la corrida.
    if (!client || !business || !service) continue;

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
      await markReminderSent(appt.id);
      sent++;
    } catch (err) {
      console.error(`No se pudo enviar el recordatorio del turno ${appt.id}`, err);
    }
  }

  return { checked: appointments.length, sent };
}

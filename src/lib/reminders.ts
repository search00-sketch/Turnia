import { getDueReminders, markReminderSent } from "./db/appointments";
import { getBusinessById } from "./db/businesses";
import { getServiceById } from "./db/services";
import { getUserByUid } from "./db/users";
import { sendUserMail, bookingReminderEmail } from "./mailer";
import { formatDateLong, formatTime } from "./format";
import { REMINDER_HOURS_BEFORE } from "./config";

/**
 * Busca turnos que empiezan dentro de las próximas ~24hs (y a los que
 * todavía no se les envió el recordatorio) y les manda el email
 * correspondiente.
 *
 * Pensado para ejecutarse una vez por día (plan gratuito de Vercel: los
 * crons del plan Hobby no pueden correr más de una vez por día) desde
 * /api/cron/reminders o desde scripts/send-reminders.ts. Por eso la
 * ventana cubre un día entero en vez de una banda angosta alrededor de
 * REMINDER_HOURS_BEFORE: con una sola corrida diaria, una ventana angosta
 * dejaría sin recordatorio a la mayoría de los turnos (sólo agarraría los
 * que caen justo en esa banda). El recordatorio deja de llegar siempre
 * ~24hs antes exacto y pasa a llegar en algún momento entre ahora y las
 * próximas ~25hs, pero le llega a todos los turnos.
 */
export async function sendDueReminders() {
  const now = new Date();
  const windowStart = now;
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
      // Si el cliente se desuscribió no se manda, pero igual se marca como
      // enviado para no volver a revisarlo en la próxima corrida.
      const delivered = await sendUserMail({
        user: client,
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
      if (delivered) sent++;
    } catch (err) {
      console.error(`No se pudo enviar el recordatorio del turno ${appt.id}`, err);
    }
  }

  return { checked: appointments.length, sent };
}

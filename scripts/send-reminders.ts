// Script standalone para enviar recordatorios de turnos.
// Pensado para dispararse desde un cron tradicional si no se aloja en Vercel, ej:
//   0 * * * *  cd /ruta/al/proyecto && npm run reminders:send >> reminders.log 2>&1
import "dotenv/config";
import { sendDueReminders } from "../src/lib/reminders";

sendDueReminders()
  .then((r) => {
    console.log(`Recordatorios: revisados ${r.checked}, enviados ${r.sent}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error enviando recordatorios:", err);
    process.exit(1);
  });

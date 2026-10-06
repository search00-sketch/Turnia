import nodemailer from "nodemailer";
import { APP_NAME } from "@/lib/config";
import { appUrl, oneClickUnsubscribeUrl, unsubscribePageUrl } from "@/lib/unsubscribe";

let transporter: nodemailer.Transporter | null = null;
let usingRealSmtp = false;

function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    usingRealSmtp = true;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
  } else {
    // Sin configuración SMTP: no se envía nada de verdad, sólo queda registrado
    // en consola. Ideal para desarrollo local sin depender de un servicio externo.
    usingRealSmtp = false;
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }

  return transporter;
}

export async function sendMail({
  to,
  subject,
  html,
  headers,
}: {
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
}) {
  const t = getTransporter();
  const info = await t.sendMail({
    from: process.env.SMTP_FROM || `${APP_NAME} <no-reply@turnia.app>`,
    to,
    subject,
    html,
    // Versión en texto plano: los filtros de spam desconfían de los mails que sólo traen HTML.
    text: htmlToText(html),
    headers,
  });

  if (!usingRealSmtp) {
    // eslint-disable-next-line no-console
    console.log(`[mailer] SMTP no configurado. Email simulado para ${to}: "${subject}"`);
  }

  return info;
}

/**
 * Manda un mail a un usuario de Turnia: respeta si pidió no recibir más mails
 * y agrega el botón para desuscribirse (al pie) y la desuscripción con un clic
 * (encabezados List-Unsubscribe, que Gmail y Yahoo muestran junto al remitente).
 * Devuelve false si no se mandó porque la persona se desuscribió.
 */
export async function sendUserMail({
  user,
  subject,
  html,
}: {
  user: { id: string; email: string; emailOptOut?: boolean };
  subject: string;
  html: string;
}): Promise<boolean> {
  if (user.emailOptOut) return false;
  const footer = `
    <div style="margin-top:28px; padding-top:16px; border-top:1px solid #ece4ea; text-align:center;">
      <p style="color:#8d6f86; font-size:12px; margin:0 0 10px;">Recibís este mail porque tenés una cuenta en ${APP_NAME}.</p>
      <a href="${unsubscribePageUrl(user.id)}" style="display:inline-block; padding:8px 16px; border:1px solid #d9c9d4; border-radius:999px; color:#5b3f55; font-size:12px; font-weight:700; text-decoration:none;">Dejar de recibir estos mails</a>
    </div>`;
  await sendMail({
    to: user.email,
    subject,
    html: html.replace(UNSUBSCRIBE_SLOT, footer),
    headers: {
      "List-Unsubscribe": `<${oneClickUnsubscribeUrl(user.id)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
  return true;
}

const UNSUBSCRIBE_SLOT = "<!--unsubscribe-->";

function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|tr|h2|h3|div)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<td[^>]*>/gi, " ")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, "$2: $1")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

/** Escapa texto que viene de los usuarios (nombres, servicios) antes de meterlo en el HTML del mail. */
function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function row(label: string, value: string) {
  return `<tr><td style="padding:7px 0; color:#8d6f86; width:110px;">${label}</td><td style="padding:7px 0; font-weight:700; color:#2a1830;">${esc(value)}</td></tr>`;
}

function baseTemplate(title: string, bodyHtml: string) {
  return `
  <div style="background:#f5f2f6; padding:24px 12px;">
    <div style="font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 480px; margin: 0 auto; background:#ffffff; border-radius:18px; overflow:hidden; color:#2a1830;">
      <div style="background:#2a1830; padding:18px 24px;">
        <span style="color:#ffffff; font-size:22px; font-weight:800; letter-spacing:-0.5px;">${APP_NAME.toLowerCase()}<span style="color:#f3a6c1;">.</span></span>
      </div>
      <div style="padding:24px;">
        <h2 style="margin:0 0 12px; font-size:20px; color:#2a1830;">${title}</h2>
        ${bodyHtml}
        ${UNSUBSCRIBE_SLOT}
      </div>
    </div>
    <p style="font-family: Arial, sans-serif; color:#a3909e; font-size:11px; text-align:center; margin:14px 0 0;">Mensaje automático de ${APP_NAME}.</p>
  </div>`;
}

export function bookingConfirmationEmail(params: {
  clientName: string;
  businessName: string;
  serviceName: string;
  professionalName: string;
  dateLabel: string;
  timeLabel: string;
  address?: string | null;
}) {
  const { clientName, businessName, serviceName, professionalName, dateLabel, timeLabel, address } = params;
  return baseTemplate(
    "¡Turno confirmado!",
    `
      <p>Hola ${esc(clientName)}, tu turno fue confirmado con éxito.</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        ${row("Negocio", businessName)}
        ${row("Servicio", serviceName)}
        ${row("Profesional", professionalName)}
        ${row("Fecha", dateLabel)}
        ${row("Hora", timeLabel)}
        ${address ? row("Dirección", address) : ""}
      </table>
      <p>Podés ver o cancelar tu turno desde la sección "Mis turnos" de ${APP_NAME}.</p>
    `
  );
}

export function bookingReminderEmail(params: {
  clientName: string;
  businessName: string;
  serviceName: string;
  dateLabel: string;
  timeLabel: string;
  address?: string | null;
}) {
  const { clientName, businessName, serviceName, dateLabel, timeLabel, address } = params;
  return baseTemplate(
    "Recordatorio de tu turno",
    `
      <p>Hola ${esc(clientName)}, te recordamos tu turno en <strong>${esc(businessName)}</strong>.</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        ${row("Servicio", serviceName)}
        ${row("Fecha", dateLabel)}
        ${row("Hora", timeLabel)}
        ${address ? row("Dirección", address) : ""}
      </table>
      <p>Si no podés asistir, cancelalo desde "Mis turnos" para liberar el horario a otra persona.</p>
    `
  );
}

export function newBookingOwnerEmail(params: {
  businessName: string;
  clientName: string;
  serviceName: string;
  professionalName: string;
  dateLabel: string;
  timeLabel: string;
}) {
  const { businessName, clientName, serviceName, professionalName, dateLabel, timeLabel } = params;
  return baseTemplate(
    "Nuevo turno reservado",
    `
      <p>Tenés un nuevo turno en <strong>${esc(businessName)}</strong>.</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        ${row("Cliente", clientName)}
        ${row("Servicio", serviceName)}
        ${row("Profesional", professionalName)}
        ${row("Fecha", dateLabel)}
        ${row("Hora", timeLabel)}
      </table>
      <p>Podés verlo en tu panel de ${APP_NAME}.</p>
    `
  );
}

/** Al cliente: su turno se canceló (lo canceló él o el negocio). */
export function appointmentCancelledClientEmail(params: {
  clientName: string;
  businessName: string;
  businessSlug: string;
  serviceName: string;
  dateLabel: string;
  timeLabel: string;
  byBusiness: boolean;
  /** El negocio se dio de baja de la plataforma: el botón lleva a buscar otro lugar. */
  businessClosed?: boolean;
}) {
  const { clientName, businessName, businessSlug, serviceName, dateLabel, timeLabel, byBusiness, businessClosed } = params;
  const intro = businessClosed
    ? `<strong>${esc(businessName)}</strong> ya no toma turnos por ${APP_NAME}, así que tu turno quedó cancelado.`
    : byBusiness
      ? `<strong>${esc(businessName)}</strong> canceló tu turno.`
      : `confirmamos que cancelaste tu turno en <strong>${esc(businessName)}</strong>.`;
  const cta = businessClosed
    ? { href: `${appUrl()}/negocios`, label: "Buscar otro lugar" }
    : { href: `${appUrl()}/negocios/${businessSlug}/reservar`, label: "Reservar otro turno" };
  return baseTemplate(
    "Turno cancelado",
    `
      <p>Hola ${esc(clientName)}, ${intro}</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        ${row("Servicio", serviceName)}
        ${row("Fecha", dateLabel)}
        ${row("Hora", timeLabel)}
      </table>
      <p style="margin:20px 0 0;">
        <a href="${cta.href}" style="display:inline-block; background:#c8255a; color:#ffffff; padding:11px 20px; border-radius:999px; font-weight:800; text-decoration:none;">${cta.label}</a>
      </p>
    `
  );
}

/** Al negocio: un cliente canceló su turno (el horario quedó libre). */
export function appointmentCancelledOwnerEmail(params: {
  businessName: string;
  clientName: string;
  serviceName: string;
  professionalName: string;
  dateLabel: string;
  timeLabel: string;
}) {
  const { businessName, clientName, serviceName, professionalName, dateLabel, timeLabel } = params;
  return baseTemplate(
    "Un cliente canceló su turno",
    `
      <p>${esc(clientName)} canceló su turno en <strong>${esc(businessName)}</strong>. El horario ya quedó libre para otra reserva.</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        ${row("Cliente", clientName)}
        ${row("Servicio", serviceName)}
        ${row("Profesional", professionalName)}
        ${row("Fecha", dateLabel)}
        ${row("Hora", timeLabel)}
      </table>
      <p>Lo ves actualizado en la agenda de tu panel de ${APP_NAME}.</p>
    `
  );
}

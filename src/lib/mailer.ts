import nodemailer from "nodemailer";
import { APP_NAME } from "@/lib/config";

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
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const t = getTransporter();
  const info = await t.sendMail({
    from: process.env.SMTP_FROM || `${APP_NAME} <no-reply@turnia.app>`,
    to,
    subject,
    html,
  });

  if (!usingRealSmtp) {
    // eslint-disable-next-line no-console
    console.log(`[mailer] SMTP no configurado. Email simulado para ${to}: "${subject}"`);
  }

  return info;
}

function baseTemplate(title: string, bodyHtml: string) {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #262626;">
    <h2 style="color:#b31d4a; margin-bottom: 4px;">${APP_NAME}</h2>
    <h3 style="margin-top: 0;">${title}</h3>
    ${bodyHtml}
    <p style="color:#8a8a8a; font-size: 12px; margin-top: 32px;">Este es un mensaje automático de ${APP_NAME}.</p>
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
    "¡Turno confirmado! 🎉",
    `
      <p>Hola ${clientName}, tu turno fue confirmado con éxito.</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding:6px 0; color:#8a8a8a;">Negocio</td><td style="padding:6px 0; font-weight:600;">${businessName}</td></tr>
        <tr><td style="padding:6px 0; color:#8a8a8a;">Servicio</td><td style="padding:6px 0; font-weight:600;">${serviceName}</td></tr>
        <tr><td style="padding:6px 0; color:#8a8a8a;">Profesional</td><td style="padding:6px 0; font-weight:600;">${professionalName}</td></tr>
        <tr><td style="padding:6px 0; color:#8a8a8a;">Fecha</td><td style="padding:6px 0; font-weight:600;">${dateLabel}</td></tr>
        <tr><td style="padding:6px 0; color:#8a8a8a;">Hora</td><td style="padding:6px 0; font-weight:600;">${timeLabel}</td></tr>
        ${address ? `<tr><td style="padding:6px 0; color:#8a8a8a;">Dirección</td><td style="padding:6px 0; font-weight:600;">${address}</td></tr>` : ""}
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
    "Recordatorio de tu turno ⏰",
    `
      <p>Hola ${clientName}, te recordamos tu turno en <strong>${businessName}</strong>.</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding:6px 0; color:#8a8a8a;">Servicio</td><td style="padding:6px 0; font-weight:600;">${serviceName}</td></tr>
        <tr><td style="padding:6px 0; color:#8a8a8a;">Fecha</td><td style="padding:6px 0; font-weight:600;">${dateLabel}</td></tr>
        <tr><td style="padding:6px 0; color:#8a8a8a;">Hora</td><td style="padding:6px 0; font-weight:600;">${timeLabel}</td></tr>
        ${address ? `<tr><td style="padding:6px 0; color:#8a8a8a;">Dirección</td><td style="padding:6px 0; font-weight:600;">${address}</td></tr>` : ""}
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
    "Nuevo turno reservado 📅",
    `
      <p>Tenés un nuevo turno en <strong>${businessName}</strong>.</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding:6px 0; color:#8a8a8a;">Cliente</td><td style="padding:6px 0; font-weight:600;">${clientName}</td></tr>
        <tr><td style="padding:6px 0; color:#8a8a8a;">Servicio</td><td style="padding:6px 0; font-weight:600;">${serviceName}</td></tr>
        <tr><td style="padding:6px 0; color:#8a8a8a;">Profesional</td><td style="padding:6px 0; font-weight:600;">${professionalName}</td></tr>
        <tr><td style="padding:6px 0; color:#8a8a8a;">Fecha</td><td style="padding:6px 0; font-weight:600;">${dateLabel}</td></tr>
        <tr><td style="padding:6px 0; color:#8a8a8a;">Hora</td><td style="padding:6px 0; font-weight:600;">${timeLabel}</td></tr>
      </table>
      <p>Podés verlo en tu panel de ${APP_NAME}.</p>
    `
  );
}

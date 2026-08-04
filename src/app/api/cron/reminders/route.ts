import { NextRequest, NextResponse } from "next/server";
import { sendDueReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Vercel Cron manda automáticamente "Authorization: Bearer <CRON_SECRET>".
  // También aceptamos ?secret=... para poder usar un cron externo (cron-job.org, etc.)
  // o para probarlo manualmente desde el navegador.
  const authHeader = req.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const querySecret = req.nextUrl.searchParams.get("secret");
  const secret = bearerSecret ?? querySecret;

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await sendDueReminders();
  return NextResponse.json({ ok: true, ...result });
}

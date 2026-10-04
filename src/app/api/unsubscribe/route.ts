import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { setEmailOptOut } from "@/lib/db/users";

export const dynamic = "force-dynamic";

// Desuscripción con un clic (RFC 8058): Gmail/Yahoo hacen un POST a la URL
// del encabezado List-Unsubscribe cuando la persona toca "Anular suscripción".
export async function POST(req: Request) {
  const uid = verifyUnsubscribeToken(new URL(req.url).searchParams.get("t"));
  if (!uid) return new Response("Link inválido", { status: 400 });
  await setEmailOptOut(uid, true).catch(() => {});
  return new Response("Listo: no vas a recibir más mails de Turnia.", { status: 200 });
}

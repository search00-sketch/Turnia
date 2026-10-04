"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { setEmailOptOut } from "@/lib/db/users";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Desde el link del mail (no hace falta iniciar sesión: el link está firmado). */
export async function unsubscribeWithToken(token: string): Promise<ActionResult> {
  const uid = verifyUnsubscribeToken(token);
  if (!uid) return { ok: false, error: "El link no es válido. Podés cambiar esto desde tu Cuenta." };
  await setEmailOptOut(uid, true);
  return { ok: true };
}

/** Desde Cuenta: activar o desactivar los mails de Turnia. */
export async function setMyEmailOptOut(optOut: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };
  await setEmailOptOut(user.id, optOut);
  revalidatePath("/cuenta");
  return { ok: true };
}

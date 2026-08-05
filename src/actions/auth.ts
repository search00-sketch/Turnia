"use server";

import { z } from "zod";
import { getAdminAuth } from "@/lib/firebase-admin";
import { createUser, getUserByUid } from "@/lib/db/users";
import { isSlugTaken, createBusinessOwnerBatch, SlugTakenError } from "@/lib/db/businesses";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function verifyToken(idToken: string) {
  try {
    return await getAdminAuth().verifyIdToken(idToken);
  } catch {
    return null;
  }
}

const clientSchema = z.object({
  idToken: z.string().min(1),
  name: z.string().min(1, "Ingresá tu nombre"),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});

/**
 * Crea el perfil de cliente en Firestore, enlazado a la cuenta de Firebase que
 * el navegador ya creó (createUserWithEmailAndPassword). El idToken se verifica
 * acá para no confiar ciegamente en lo que manda el cliente.
 */
export async function registerClient(input: unknown): Promise<ActionResult> {
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { idToken, name, lastName, phone } = parsed.data;

  const decoded = await verifyToken(idToken);
  if (!decoded) return { ok: false, error: "No pudimos verificar tu cuenta. Probá de nuevo." };
  if (!decoded.email) return { ok: false, error: "Tu cuenta no tiene un email asociado." };

  const existing = await getUserByUid(decoded.uid);
  if (existing) return { ok: true };

  await createUser(decoded.uid, {
    name,
    lastName,
    email: decoded.email.toLowerCase(),
    phone,
    role: "CLIENTE",
  });

  return { ok: true };
}

const DIACRITICS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(text: string) {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(DIACRITICS_REGEX, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "negocio"
  );
}

const businessSchema = z.object({
  idToken: z.string().min(1),
  ownerName: z.string().min(1, "Ingresá tu nombre"),
  ownerLastName: z.string().optional(),
  phone: z.string().optional(),
  businessName: z.string().min(2, "Ingresá el nombre del negocio"),
  category: z.string().min(1, "Elegí una categoría"),
  address: z.string().optional(),
  whatsapp: z.string().optional(),
  description: z.string().optional(),
});

const STANDARD_HOURS = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  isClosed: dayOfWeek === 0,
  openTime: dayOfWeek === 0 ? null : "10:00",
  closeTime: dayOfWeek === 0 ? null : "20:00",
}));

export async function registerBusiness(input: unknown): Promise<ActionResult> {
  const parsed = businessSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  const decoded = await verifyToken(data.idToken);
  if (!decoded) return { ok: false, error: "No pudimos verificar tu cuenta. Probá de nuevo." };
  if (!decoded.email) return { ok: false, error: "Tu cuenta no tiene un email asociado." };

  const existingUser = await getUserByUid(decoded.uid);
  if (existingUser) {
    return { ok: false, error: "Esta cuenta ya está registrada." };
  }

  const baseSlug = slugify(data.businessName);
  let slug = baseSlug;
  let i = 1;

  // isSlugTaken() es sólo una pre-chequeada rápida para el caso común (evita
  // intentos de transacción innecesarios); createBusinessOwnerBatch es quien
  // realmente garantiza la unicidad de forma atómica. Si dos registros
  // concurrentes eligen el mismo slug, uno de los dos recibe SlugTakenError
  // acá y reintenta con el siguiente sufijo.
  for (let attempt = 0; attempt < 10; attempt++) {
    while (await isSlugTaken(slug)) {
      slug = `${baseSlug}-${i++}`;
    }

    try {
      await createBusinessOwnerBatch({
        ownerId: decoded.uid,
        ownerData: {
          name: data.ownerName,
          lastName: data.ownerLastName,
          email: decoded.email.toLowerCase(),
          phone: data.phone,
        },
        businessData: {
          slug,
          name: data.businessName,
          category: data.category,
          description: data.description,
          address: data.address,
          phone: data.phone,
          whatsapp: data.whatsapp,
        },
        hours: STANDARD_HOURS,
      });
      return { ok: true };
    } catch (err) {
      if (err instanceof SlugTakenError) {
        slug = `${baseSlug}-${i++}`;
        continue;
      }
      throw err;
    }
  }

  return { ok: false, error: "No pudimos generar un nombre único para tu negocio. Probá de nuevo." };
}

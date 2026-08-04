"use server";

import { z } from "zod";
import { getAdminAuth } from "@/lib/firebase-admin";
import { prisma } from "@/lib/prisma";

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
 * Crea el perfil de cliente en nuestra base de datos, enlazado a la cuenta de
 * Firebase que el navegador ya creó (createUserWithEmailAndPassword). El
 * idToken se verifica acá para no confiar ciegamente en lo que manda el cliente.
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

  const existing = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });
  if (existing) return { ok: true };

  await prisma.user.create({
    data: {
      firebaseUid: decoded.uid,
      name,
      lastName,
      email: decoded.email.toLowerCase(),
      phone,
      role: "CLIENTE",
    },
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

export async function registerBusiness(input: unknown): Promise<ActionResult> {
  const parsed = businessSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  const decoded = await verifyToken(data.idToken);
  if (!decoded) return { ok: false, error: "No pudimos verificar tu cuenta. Probá de nuevo." };
  if (!decoded.email) return { ok: false, error: "Tu cuenta no tiene un email asociado." };

  const existingUser = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });
  if (existingUser) {
    return { ok: false, error: "Esta cuenta ya está registrada." };
  }

  const baseSlug = slugify(data.businessName);
  let slug = baseSlug;
  let i = 1;
  while (await prisma.business.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${i++}`;
  }

  await prisma.user.create({
    data: {
      firebaseUid: decoded.uid,
      name: data.ownerName,
      lastName: data.ownerLastName,
      email: decoded.email.toLowerCase(),
      phone: data.phone,
      role: "NEGOCIO",
      business: {
        create: {
          slug,
          name: data.businessName,
          category: data.category,
          description: data.description,
          address: data.address,
          whatsapp: data.whatsapp,
          phone: data.phone,
          hours: {
            create: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
              dayOfWeek,
              isClosed: dayOfWeek === 0,
              openTime: dayOfWeek === 0 ? null : "10:00",
              closeTime: dayOfWeek === 0 ? null : "20:00",
            })),
          },
        },
      },
    },
  });

  return { ok: true };
}

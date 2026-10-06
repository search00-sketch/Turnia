"use server";

import { z } from "zod";
import { getAdminAuth } from "@/lib/firebase-admin";
import { createUser, getUserByUid } from "@/lib/db/users";
import { isSlugTaken, createBusinessOwnerBatch, SlugTakenError, AlreadyHasBusinessError } from "@/lib/db/businesses";
import { getCurrentUser } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };
/** needsVerification: la cuenta es de email y contraseña sin confirmar; hay que mandar el mail. */
export type RegisterResult = { ok: true; needsVerification: boolean } | { ok: false; error: string };

const ROLE_LABEL: Record<string, string> = {
  CLIENTE: "cliente",
  NEGOCIO: "negocio",
  ADMIN: "administrador",
};

function emailInUseByOtherRole(role: string) {
  return (
    `Ese email ya tiene una cuenta de ${ROLE_LABEL[role] ?? role}. Para crear otra cuenta usá otro email ` +
    "(con Gmail podés usar un alias, por ejemplo tunombre+negocio@gmail.com: los mails te llegan igual)."
  );
}

async function verifyToken(idToken: string) {
  try {
    return await getAdminAuth().verifyIdToken(idToken);
  } catch {
    return null;
  }
}

type DecodedToken = NonNullable<Awaited<ReturnType<typeof verifyToken>>>;

/** Las cuentas de email y contraseña tienen que confirmar el email; las de Google ya vienen confirmadas. */
function needsEmailVerification(decoded: DecodedToken): boolean {
  return decoded.firebase.sign_in_provider === "password" && decoded.email_verified !== true;
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
export async function registerClient(input: unknown): Promise<RegisterResult> {
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { idToken, name, lastName, phone } = parsed.data;

  const decoded = await verifyToken(idToken);
  if (!decoded) return { ok: false, error: "No pudimos verificar tu cuenta. Probá de nuevo." };
  if (!decoded.email) return { ok: false, error: "Tu cuenta no tiene un email asociado." };

  const existing = await getUserByUid(decoded.uid);
  if (existing) {
    // Clientes y dueños de negocio pueden reservar con la misma cuenta: ya es suya, entra.
    return existing.role === "CLIENTE" || existing.role === "NEGOCIO"
      ? { ok: true, needsVerification: existing.requiresEmailVerification && decoded.email_verified !== true }
      : { ok: false, error: emailInUseByOtherRole(existing.role) };
  }

  const needsVerification = needsEmailVerification(decoded);
  await createUser(decoded.uid, {
    name,
    lastName,
    email: decoded.email.toLowerCase(),
    phone,
    role: "CLIENTE",
    requiresEmailVerification: needsVerification,
  });

  return { ok: true, needsVerification };
}

/**
 * Alta como cliente de alguien que entró con Google y todavía no tiene perfil.
 * El nombre sale de la cuenta de Google (se puede editar más adelante).
 */
export async function registerGoogleClient(idToken: string): Promise<ActionResult> {
  const decoded = await verifyToken(idToken);
  if (!decoded) return { ok: false, error: "No pudimos verificar tu cuenta. Probá de nuevo." };
  if (!decoded.email) return { ok: false, error: "Tu cuenta de Google no tiene un email asociado." };

  const existing = await getUserByUid(decoded.uid);
  if (existing) {
    return existing.role === "CLIENTE" || existing.role === "NEGOCIO"
      ? { ok: true }
      : { ok: false, error: emailInUseByOtherRole(existing.role) };
  }

  const [name, ...rest] = (decoded.name ?? decoded.email.split("@")[0]).trim().split(/\s+/);
  await createUser(decoded.uid, {
    name: name || "Cliente",
    lastName: rest.join(" ") || undefined,
    email: decoded.email.toLowerCase(),
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

export async function registerBusiness(input: unknown): Promise<RegisterResult> {
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
    if (existingUser.role === "NEGOCIO") {
      return { ok: false, error: "Ese email ya tiene un negocio registrado. Ingresá desde \"Iniciar sesión\"." };
    }
    if (existingUser.role === "CLIENTE") {
      // Ya demostró que es su cuenta (ingresó con su contraseña o con Google):
      // se le suma el negocio a la misma cuenta en vez de pedirle otro email.
      const created = await createBusinessWithUniqueSlug({ ownerId: decoded.uid, business: data });
      if (!created.ok) return created;
      return { ok: true, needsVerification: existingUser.requiresEmailVerification && decoded.email_verified !== true };
    }
    return { ok: false, error: emailInUseByOtherRole(existingUser.role) };
  }

  const needsVerification = needsEmailVerification(decoded);
  const created = await createBusinessWithUniqueSlug({
    ownerId: decoded.uid,
    ownerData: {
      name: data.ownerName,
      lastName: data.ownerLastName,
      email: decoded.email.toLowerCase(),
      phone: data.phone,
      requiresEmailVerification: needsVerification,
    },
    business: data,
  });
  return created.ok ? { ok: true, needsVerification } : created;
}

type BusinessFields = {
  businessName: string;
  category: string;
  description?: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
};

/**
 * Crea el negocio buscando un slug libre. isSlugTaken() es sólo una
 * pre-chequeada rápida; createBusinessOwnerBatch garantiza la unicidad de
 * forma atómica, y si dos registros concurrentes eligen el mismo slug, uno
 * recibe SlugTakenError y reintenta con el siguiente sufijo.
 */
async function createBusinessWithUniqueSlug(input: {
  ownerId: string;
  ownerData?: Parameters<typeof createBusinessOwnerBatch>[0]["ownerData"];
  business: BusinessFields;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const baseSlug = slugify(input.business.businessName);
  let slug = baseSlug;
  let i = 1;

  for (let attempt = 0; attempt < 10; attempt++) {
    while (await isSlugTaken(slug)) {
      slug = `${baseSlug}-${i++}`;
    }

    try {
      await createBusinessOwnerBatch({
        ownerId: input.ownerId,
        ownerData: input.ownerData,
        businessData: {
          slug,
          name: input.business.businessName,
          category: input.business.category,
          description: input.business.description,
          address: input.business.address,
          phone: input.business.phone,
          whatsapp: input.business.whatsapp,
        },
        hours: STANDARD_HOURS,
      });
      return { ok: true };
    } catch (err) {
      if (err instanceof SlugTakenError) {
        slug = `${baseSlug}-${i++}`;
        continue;
      }
      if (err instanceof AlreadyHasBusinessError) {
        return { ok: false, error: "Esta cuenta ya tiene un negocio. Entrá a tu panel para administrarlo." };
      }
      throw err;
    }
  }

  return { ok: false, error: "No pudimos generar un nombre único para tu negocio. Probá de nuevo." };
}

const addBusinessSchema = z.object({
  businessName: z.string().min(2, "Ingresá el nombre del negocio"),
  category: z.string().min(1, "Elegí una categoría"),
  phone: z.string().optional(),
  address: z.string().optional(),
  whatsapp: z.string().optional(),
  description: z.string().optional(),
});

/**
 * Un cliente con sesión iniciada suma su negocio a la misma cuenta: pasa a
 * tener panel de negocio y sigue pudiendo reservar y ver sus turnos.
 */
export async function addBusinessToMyAccount(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };
  if (user.role === "ADMIN") {
    return { ok: false, error: "Las cuentas de administrador no pueden tener un negocio. Usá otra cuenta." };
  }
  if (user.business) return { ok: false, error: "Tu cuenta ya tiene un negocio. Entrá a tu panel para administrarlo." };

  const parsed = addBusinessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  return createBusinessWithUniqueSlug({ ownerId: user.id, business: parsed.data });
}

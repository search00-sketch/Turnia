import "dotenv/config";
import { getAdminAuth } from "../src/lib/firebase-admin";
import { getBusinessBySlug, createBusinessOwnerBatch } from "../src/lib/db/businesses";
import { createService, getServicesByBusiness } from "../src/lib/db/services";
import { createProfessional, getProfessionalsByBusiness } from "../src/lib/db/professionals";
import { createUser, getUserByUid } from "../src/lib/db/users";
import { createAppointmentDoc } from "../src/lib/db/appointments";

const DEMO_PASSWORD = "demo1234";

function atTime(base: Date, days: number, hh: number, mm: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(hh, mm, 0, 0);
  return d;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

// Crea el usuario en Firebase Auth (o lo reutiliza si ya existe de una corrida anterior).
async function getOrCreateFirebaseUser(email: string, displayName: string): Promise<string> {
  const auth = getAdminAuth();
  try {
    const existing = await auth.getUserByEmail(email);
    return existing.uid;
  } catch {
    const created = await auth.createUser({ email, password: DEMO_PASSWORD, displayName });
    return created.uid;
  }
}

interface BusinessHourSeed {
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

const STANDARD_HOURS: BusinessHourSeed[] = [
  { dayOfWeek: 0, isClosed: true, openTime: null, closeTime: null },
  { dayOfWeek: 1, isClosed: false, openTime: "10:00", closeTime: "20:00" },
  { dayOfWeek: 2, isClosed: false, openTime: "10:00", closeTime: "20:00" },
  { dayOfWeek: 3, isClosed: false, openTime: "10:00", closeTime: "20:00" },
  { dayOfWeek: 4, isClosed: false, openTime: "10:00", closeTime: "20:00" },
  { dayOfWeek: 5, isClosed: false, openTime: "10:00", closeTime: "20:00" },
  { dayOfWeek: 6, isClosed: false, openTime: "10:00", closeTime: "15:00" },
];

const BARBERIA_HOURS = STANDARD_HOURS.map((h) => (h.isClosed ? h : { ...h, openTime: "09:00" }));

interface BusinessSeed {
  slug: string;
  ownerEmail: string;
  ownerDisplayName: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerPhone: string;
  businessName: string;
  category: string;
  description: string;
  address: string;
  phone: string;
  whatsapp: string;
  hours: typeof STANDARD_HOURS;
  professionals: string[];
  services: { category: string; name: string; description?: string; price: number; cost?: number; durationMin: number }[];
}

// Si el negocio ya existe (slug ya tomado), no vuelve a crear nada — así
// `npm run db:seed` es seguro de correr más de una vez.
async function ensureBusiness(seed: BusinessSeed): Promise<{ id: string; isNew: boolean }> {
  const existing = await getBusinessBySlug(seed.slug);
  if (existing) return { id: existing.id, isNew: false };

  const ownerUid = await getOrCreateFirebaseUser(seed.ownerEmail, seed.ownerDisplayName);
  const id = await createBusinessOwnerBatch({
    ownerId: ownerUid,
    ownerData: {
      name: seed.ownerFirstName,
      lastName: seed.ownerLastName,
      email: seed.ownerEmail,
      phone: seed.ownerPhone,
    },
    businessData: {
      slug: seed.slug,
      name: seed.businessName,
      category: seed.category,
      description: seed.description,
      address: seed.address,
      phone: seed.phone,
      whatsapp: seed.whatsapp,
    },
    hours: seed.hours,
  });

  for (const name of seed.professionals) {
    await createProfessional(id, { name });
  }
  for (const service of seed.services) {
    await createService(id, service);
  }

  return { id, isNew: true };
}

const BUSINESS_SEEDS: BusinessSeed[] = [
  {
    slug: "nueva-imagen-peluqueria",
    ownerEmail: "maria@nuevaimagen.com",
    ownerDisplayName: "María López",
    ownerFirstName: "María",
    ownerLastName: "López",
    ownerPhone: "1122334455",
    businessName: "Nueva Imagen Peluquería",
    category: "peluqueria",
    description: "Peluquería en Palermo especializada en color, cortes modernos y tratamientos capilares.",
    address: "Av. Santa Fe 3450, Palermo, CABA",
    phone: "1145678901",
    whatsapp: "5491145678901",
    hours: STANDARD_HOURS,
    professionals: ["María López", "Jorge Batista"],
    services: [
      { category: "Corte", name: "Corte Mujer", description: "Incluye lavado y secado.", price: 18000, cost: 3000, durationMin: 45 },
      { category: "Corte", name: "Corte Hombre", price: 12000, cost: 2000, durationMin: 30 },
      { category: "Color", name: "Coloración raíz", description: "Retoque de raíz hasta 3cm.", price: 25000, cost: 8000, durationMin: 60 },
      { category: "Color", name: "Balayage", description: "Técnica de iluminación con degradado natural.", price: 60000, cost: 18000, durationMin: 120 },
      { category: "Peinados", name: "Brushing", price: 15000, cost: 2500, durationMin: 30 },
    ],
  },
  {
    slug: "barberia-el-zorro",
    ownerEmail: "diego@elzorro.com",
    ownerDisplayName: "Diego Fernández",
    ownerFirstName: "Diego",
    ownerLastName: "Fernández",
    ownerPhone: "1133445566",
    businessName: "Barbería El Zorro",
    category: "barberia",
    description: "Cortes clásicos y modernos, arreglo de barba y afeitado a navaja en Villa Crespo.",
    address: "Corrientes 5120, Villa Crespo, CABA",
    phone: "1156789012",
    whatsapp: "5491156789012",
    hours: BARBERIA_HOURS,
    professionals: ["Diego Fernández", "Nacho Gómez"],
    services: [
      { category: "Corte", name: "Corte clásico", price: 10000, cost: 1500, durationMin: 30 },
      { category: "Corte", name: "Corte + Barba", price: 15000, cost: 2500, durationMin: 45 },
      { category: "Barba", name: "Arreglo de barba", price: 7000, cost: 1200, durationMin: 20 },
    ],
  },
  {
    slug: "spa-bienestar-olivos",
    ownerEmail: "carla@spaolivos.com",
    ownerDisplayName: "Carla Núñez",
    ownerFirstName: "Carla",
    ownerLastName: "Núñez",
    ownerPhone: "1177889900",
    businessName: "Spa Bienestar Olivos",
    category: "spa",
    description: "Masajes, manicura y pedicura en un espacio pensado para desconectar.",
    address: "Maipú 1780, Olivos, Buenos Aires",
    phone: "1178901234",
    whatsapp: "5491178901234",
    hours: STANDARD_HOURS,
    professionals: ["Carla Núñez", "Sofía Ruiz"],
    services: [
      { category: "Masajes", name: "Masaje relajante", price: 30000, cost: 5000, durationMin: 60 },
      { category: "Masajes", name: "Masaje descontracturante", price: 26000, cost: 4500, durationMin: 45 },
      { category: "Uñas", name: "Manicura", price: 12000, cost: 2500, durationMin: 40 },
      { category: "Uñas", name: "Pedicura", price: 15000, cost: 3000, durationMin: 50 },
    ],
  },
];

async function main() {
  console.log("Sembrando Firestore...");
  const now = new Date();

  const results = await Promise.all(BUSINESS_SEEDS.map(ensureBusiness));
  const [business1, business2, business3] = results;

  const clientUid = await getOrCreateFirebaseUser("juan@cliente.com", "Juan Pérez");
  const existingClient = await getUserByUid(clientUid);
  if (!existingClient) {
    await createUser(clientUid, {
      name: "Juan",
      lastName: "Pérez",
      email: "juan@cliente.com",
      phone: "1199887766",
      role: "CLIENTE",
    });
  }

  // Los 3 turnos de ejemplo sólo se crean la primera vez (cuando el negocio 1
  // recién se creó) — así `npm run db:seed` es seguro de correr de nuevo.
  if (business1.isNew) {
    const professionals1 = await getProfessionalsByBusiness(business1.id);
    const services1 = await getServicesByBusiness(business1.id);
    const jorge = professionals1.find((p) => p.name === "Jorge Batista")!;
    const corteHombre = services1.find((s) => s.name === "Corte Hombre")!;
    const turno1Start = atTime(now, 1, 11, 0);
    await createAppointmentDoc({
      businessId: business1.id,
      professionalId: jorge.id,
      serviceId: corteHombre.id,
      clientId: clientUid,
      startsAt: turno1Start,
      endsAt: addMinutes(turno1Start, corteHombre.durationMin),
      status: "CONFIRMADO",
      price: corteHombre.price,
      cost: corteHombre.cost,
    });

    const professionals3 = await getProfessionalsByBusiness(business3.id);
    const services3 = await getServicesByBusiness(business3.id);
    const sofia = professionals3.find((p) => p.name === "Sofía Ruiz")!;
    const manicura = services3.find((s) => s.name === "Manicura")!;
    const turno2Start = atTime(now, 3, 18, 30);
    await createAppointmentDoc({
      businessId: business3.id,
      professionalId: sofia.id,
      serviceId: manicura.id,
      clientId: clientUid,
      startsAt: turno2Start,
      endsAt: addMinutes(turno2Start, manicura.durationMin),
      status: "CONFIRMADO",
      price: manicura.price,
      cost: manicura.cost,
    });

    const professionals2 = await getProfessionalsByBusiness(business2.id);
    const services2 = await getServicesByBusiness(business2.id);
    const diego = professionals2.find((p) => p.name === "Diego Fernández")!;
    const corteClasico = services2.find((s) => s.name === "Corte clásico")!;
    const turnoPasadoStart = atTime(now, -7, 16, 0);
    await createAppointmentDoc({
      businessId: business2.id,
      professionalId: diego.id,
      serviceId: corteClasico.id,
      clientId: clientUid,
      startsAt: turnoPasadoStart,
      endsAt: addMinutes(turnoPasadoStart, corteClasico.durationMin),
      status: "COMPLETADO",
      price: corteClasico.price,
      cost: corteClasico.cost,
    });
  }

  console.log("Listo. Usuarios de prueba (contraseña para todos: demo1234):");
  console.log("  Negocio 1  -> maria@nuevaimagen.com   (Nueva Imagen Peluquería)");
  console.log("  Negocio 2  -> diego@elzorro.com        (Barbería El Zorro)");
  console.log("  Negocio 3  -> carla@spaolivos.com      (Spa Bienestar Olivos)");
  console.log("  Cliente    -> juan@cliente.com");
  console.log("");
  console.log("Estos usuarios se crean tanto en Firebase Authentication como en Firestore,");
  console.log("así que ya podés iniciar sesión con ellos desde /login.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

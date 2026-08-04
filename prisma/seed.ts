import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { getAdminAuth } from "../src/lib/firebase-admin";

const prisma = new PrismaClient();
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

// Crea el usuario en Firebase Auth (o lo reutiliza si ya existe de una corrida anterior)
// y devuelve su UID, que es lo que enlaza el usuario de Firebase con la fila en Postgres.
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

// Horario estándar: Lunes(1) a Viernes(5) 10-20, Sábado(6) 10-15, Domingo(0) cerrado.
const STANDARD_HOURS = [
  { dayOfWeek: 0, isClosed: true, openTime: null, closeTime: null },
  { dayOfWeek: 1, isClosed: false, openTime: "10:00", closeTime: "20:00" },
  { dayOfWeek: 2, isClosed: false, openTime: "10:00", closeTime: "20:00" },
  { dayOfWeek: 3, isClosed: false, openTime: "10:00", closeTime: "20:00" },
  { dayOfWeek: 4, isClosed: false, openTime: "10:00", closeTime: "20:00" },
  { dayOfWeek: 5, isClosed: false, openTime: "10:00", closeTime: "20:00" },
  { dayOfWeek: 6, isClosed: false, openTime: "10:00", closeTime: "15:00" },
];

const BARBERIA_HOURS = STANDARD_HOURS.map((h) =>
  h.isClosed ? h : { ...h, openTime: "09:00" }
);

async function main() {
  console.log("Sembrando base de datos...");
  const now = new Date();

  // ---------- Negocio 1: Peluquería ----------
  const owner1Uid = await getOrCreateFirebaseUser("maria@nuevaimagen.com", "María López");
  const owner1 = await prisma.user.create({
    data: {
      firebaseUid: owner1Uid,
      name: "María",
      lastName: "López",
      email: "maria@nuevaimagen.com",
      phone: "1122334455",
      role: "NEGOCIO",
    },
  });

  const business1 = await prisma.business.create({
    data: {
      slug: "nueva-imagen-peluqueria",
      name: "Nueva Imagen Peluquería",
      category: "peluqueria",
      description:
        "Peluquería en Palermo especializada en color, cortes modernos y tratamientos capilares.",
      address: "Av. Santa Fe 3450, Palermo, CABA",
      phone: "1145678901",
      whatsapp: "5491145678901",
      ownerId: owner1.id,
      hours: { create: STANDARD_HOURS },
    },
  });

  const [maria, jorge] = await Promise.all([
    prisma.professional.create({ data: { businessId: business1.id, name: "María López" } }),
    prisma.professional.create({ data: { businessId: business1.id, name: "Jorge Batista" } }),
  ]);

  const [corteMujer, corteHombre, colorRaiz, balayage, brushing] = await Promise.all([
    prisma.service.create({ data: { businessId: business1.id, category: "Corte", name: "Corte Mujer", description: "Incluye lavado y secado.", price: 18000, durationMin: 45 } }),
    prisma.service.create({ data: { businessId: business1.id, category: "Corte", name: "Corte Hombre", price: 12000, durationMin: 30 } }),
    prisma.service.create({ data: { businessId: business1.id, category: "Color", name: "Coloración raíz", description: "Retoque de raíz hasta 3cm.", price: 25000, durationMin: 60 } }),
    prisma.service.create({ data: { businessId: business1.id, category: "Color", name: "Balayage", description: "Técnica de iluminación con degradado natural.", price: 60000, durationMin: 120 } }),
    prisma.service.create({ data: { businessId: business1.id, category: "Peinados", name: "Brushing", price: 15000, durationMin: 30 } }),
  ]);

  // ---------- Negocio 2: Barbería ----------
  const owner2Uid = await getOrCreateFirebaseUser("diego@elzorro.com", "Diego Fernández");
  const owner2 = await prisma.user.create({
    data: {
      firebaseUid: owner2Uid,
      name: "Diego",
      lastName: "Fernández",
      email: "diego@elzorro.com",
      phone: "1133445566",
      role: "NEGOCIO",
    },
  });

  const business2 = await prisma.business.create({
    data: {
      slug: "barberia-el-zorro",
      name: "Barbería El Zorro",
      category: "barberia",
      description: "Cortes clásicos y modernos, arreglo de barba y afeitado a navaja en Villa Crespo.",
      address: "Corrientes 5120, Villa Crespo, CABA",
      phone: "1156789012",
      whatsapp: "5491156789012",
      ownerId: owner2.id,
      hours: { create: BARBERIA_HOURS },
    },
  });

  const [diego, nacho] = await Promise.all([
    prisma.professional.create({ data: { businessId: business2.id, name: "Diego Fernández" } }),
    prisma.professional.create({ data: { businessId: business2.id, name: "Nacho Gómez" } }),
  ]);

  const [corteClasico, corteBarba, arregloBarba] = await Promise.all([
    prisma.service.create({ data: { businessId: business2.id, category: "Corte", name: "Corte clásico", price: 10000, durationMin: 30 } }),
    prisma.service.create({ data: { businessId: business2.id, category: "Corte", name: "Corte + Barba", price: 15000, durationMin: 45 } }),
    prisma.service.create({ data: { businessId: business2.id, category: "Barba", name: "Arreglo de barba", price: 7000, durationMin: 20 } }),
  ]);

  // ---------- Negocio 3: Spa ----------
  const owner3Uid = await getOrCreateFirebaseUser("carla@spaolivos.com", "Carla Núñez");
  const owner3 = await prisma.user.create({
    data: {
      firebaseUid: owner3Uid,
      name: "Carla",
      lastName: "Núñez",
      email: "carla@spaolivos.com",
      phone: "1177889900",
      role: "NEGOCIO",
    },
  });

  const business3 = await prisma.business.create({
    data: {
      slug: "spa-bienestar-olivos",
      name: "Spa Bienestar Olivos",
      category: "spa",
      description: "Masajes, manicura y pedicura en un espacio pensado para desconectar.",
      address: "Maipú 1780, Olivos, Buenos Aires",
      phone: "1178901234",
      whatsapp: "5491178901234",
      ownerId: owner3.id,
      hours: { create: STANDARD_HOURS },
    },
  });

  const [carla, sofia] = await Promise.all([
    prisma.professional.create({ data: { businessId: business3.id, name: "Carla Núñez" } }),
    prisma.professional.create({ data: { businessId: business3.id, name: "Sofía Ruiz" } }),
  ]);

  await Promise.all([
    prisma.service.create({ data: { businessId: business3.id, category: "Masajes", name: "Masaje relajante", price: 30000, durationMin: 60 } }),
    prisma.service.create({ data: { businessId: business3.id, category: "Masajes", name: "Masaje descontracturante", price: 26000, durationMin: 45 } }),
    prisma.service.create({ data: { businessId: business3.id, category: "Uñas", name: "Manicura", price: 12000, durationMin: 40 } }),
    prisma.service.create({ data: { businessId: business3.id, category: "Uñas", name: "Pedicura", price: 15000, durationMin: 50 } }),
  ]);

  // ---------- Cliente de prueba con turnos ----------
  const clientUid = await getOrCreateFirebaseUser("juan@cliente.com", "Juan Pérez");
  const client = await prisma.user.create({
    data: {
      firebaseUid: clientUid,
      name: "Juan",
      lastName: "Pérez",
      email: "juan@cliente.com",
      phone: "1199887766",
      role: "CLIENTE",
    },
  });

  const turno1Start = atTime(now, 1, 11, 0); // mañana 11:00
  await prisma.appointment.create({
    data: {
      businessId: business1.id,
      professionalId: jorge.id,
      serviceId: corteHombre.id,
      clientId: client.id,
      startsAt: turno1Start,
      endsAt: addMinutes(turno1Start, corteHombre.durationMin),
      status: "CONFIRMADO",
    },
  });

  const turno2Start = atTime(now, 3, 18, 30); // en 3 días 18:30
  await prisma.appointment.create({
    data: {
      businessId: business3.id,
      professionalId: sofia.id,
      serviceId: (await prisma.service.findFirstOrThrow({ where: { businessId: business3.id, name: "Manicura" } })).id,
      clientId: client.id,
      startsAt: turno2Start,
      endsAt: addMinutes(turno2Start, 40),
      status: "CONFIRMADO",
    },
  });

  const turnoPasadoStart = atTime(now, -7, 16, 0); // hace 7 días
  await prisma.appointment.create({
    data: {
      businessId: business2.id,
      professionalId: diego.id,
      serviceId: corteClasico.id,
      clientId: client.id,
      startsAt: turnoPasadoStart,
      endsAt: addMinutes(turnoPasadoStart, corteClasico.durationMin),
      status: "COMPLETADO",
    },
  });

  console.log("Listo. Usuarios de prueba (contraseña para todos: demo1234):");
  console.log("  Negocio 1  -> maria@nuevaimagen.com   (Nueva Imagen Peluquería)");
  console.log("  Negocio 2  -> diego@elzorro.com        (Barbería El Zorro)");
  console.log("  Negocio 3  -> carla@spaolivos.com      (Spa Bienestar Olivos)");
  console.log("  Cliente    -> juan@cliente.com");
  console.log("");
  console.log("Estos usuarios se crean tanto en Firebase Authentication como en Postgres,");
  console.log("así que ya podés iniciar sesión con ellos desde /login.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

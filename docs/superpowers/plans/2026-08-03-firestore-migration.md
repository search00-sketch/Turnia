# Migración de Prisma/Postgres a Firestore — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar Prisma/Postgres por Firestore (Admin SDK) como único motor de datos de Turnia, sin cambiar el modelo de autorización ni la estructura de páginas/componentes existente.

**Architecture:** Todo el acceso a datos sigue siendo server-only (Server Actions / Server Components), ahora contra Firestore vía `firebase-admin/firestore` en vez de Prisma. Se agrega una capa fina `src/lib/db/*.ts` (una función por necesidad real de los call sites, no un ORM genérico) que reemplaza cada `prisma.<modelo>.<método>`. No se escriben Firestore Security Rules de datos porque el navegador nunca accede a Firestore directo para datos de negocio.

**Tech Stack:** Next.js 14 (App Router) + TypeScript, `firebase-admin` (ya en el proyecto), Firestore.

Referencia: spec completo en `docs/superpowers/specs/2026-08-03-firestore-migration-design.md`.

## Global Constraints

- Todas las colecciones van prefijadas `turnia_` (proyecto Firebase compartido con otra app — ver spec).
- Sin Firestore Security Rules de datos: toda la autorización vive en código (Server Actions), igual que hoy.
- Sin joins: hidratar relaciones leyendo IDs referenciados y trayéndolos con `db.getAll(...refs)`.
- Un solo índice compuesto: `turnia_appointments` (`businessId` ASC + `startsAt` ASC).
- No hay framework de tests automatizados en este proyecto — verificación via `npx tsc --noEmit`, `npm run build`, scripts `tsx` puntuales contra el Firestore real (credenciales ya en `.env`), y una pasada manual end-to-end final.
- No se introduce un framework de testing nuevo como parte de esta migración (fuera de alcance del spec aprobado).
- Los componentes de `src/components/*.tsx` no se tocan: ya definen sus propios tipos de props (no importan `@prisma/client`), y los `Doc` types nuevos son compatibles estructuralmente.

---

## Task 1: Firestore Admin SDK wiring

**Files:**
- Modify: `src/lib/firebase-admin.ts`
- Create: `src/lib/db/collections.ts`

**Interfaces:**
- Produces: `getAdminDb(): Firestore` (además del ya existente `getAdminAuth()`), `COLLECTIONS` (objeto con los 6 nombres de colección prefijados).

- [ ] **Step 1: Extender `firebase-admin.ts` con `getAdminDb()`**

Reemplazar el contenido completo de `src/lib/firebase-admin.ts`:

```ts
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// El SDK de administración corre sólo en el servidor (Node.js), nunca en el navegador
// ni en middleware (que corre en el runtime Edge, sin soporte para este SDK).
function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // En el .env la clave privada se guarda con "\n" literales; hay que convertirlos
  // a saltos de línea reales para que la credencial sea válida.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Faltan variables de entorno de Firebase Admin: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y/o FIREBASE_PRIVATE_KEY. " +
        "Revisá tu .env (ver .env.example)."
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

let dbInstance: Firestore | undefined;

export function getAdminDb(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(getAdminApp());
    // Los Server Actions pasan campos opcionales como `undefined` (vía Zod
    // `.optional()`) cuando el usuario no los completó. Sin esto, Firestore
    // tira error al escribir un `undefined`. Con esto, el campo se omite del
    // write (no se toca), igual que hace Prisma con `undefined` en `update`.
    dbInstance.settings({ ignoreUndefinedProperties: true });
  }
  return dbInstance;
}
```

- [ ] **Step 2: Crear `src/lib/db/collections.ts`**

```ts
export const COLLECTIONS = {
  users: "turnia_users",
  businesses: "turnia_businesses",
  services: "turnia_services",
  professionals: "turnia_professionals",
  businessHours: "turnia_businessHours",
  appointments: "turnia_appointments",
} as const;
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos relacionados a estos dos archivos.

- [ ] **Step 4: Verificar conexión real a Firestore**

Crear un script descartable y correrlo:

```bash
cat > /tmp/verify-task1.ts << 'EOF'
import "dotenv/config";
import { getAdminDb } from "./src/lib/firebase-admin";

async function main() {
  const db = getAdminDb();
  const ref = db.collection("turnia_users").doc("__verify_task1__");
  await ref.set({ ping: "pong" });
  const snap = await ref.get();
  console.log("Leído de Firestore:", snap.data());
  await ref.delete();
  console.log("OK: escritura, lectura y borrado funcionan.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
EOF
npx tsx /tmp/verify-task1.ts
```

Expected: imprime `Leído de Firestore: { ping: 'pong' }` y `OK: ...`, sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/lib/firebase-admin.ts src/lib/db/collections.ts
git commit -m "feat: add Firestore Admin SDK wiring"
```

---

## Task 2: `src/lib/db/users.ts`

**Files:**
- Create: `src/lib/db/users.ts`

**Interfaces:**
- Consumes: `getAdminDb()`, `COLLECTIONS` (Task 1).
- Produces: `UserDoc`, `Role`, `mapUserDoc(snap)`, `getUserByUid(uid)`, `createUser(uid, data)`.

- [ ] **Step 1: Crear `src/lib/db/users.ts`**

```ts
import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";

export type Role = "CLIENTE" | "NEGOCIO" | "ADMIN";

export interface UserDoc {
  id: string;
  name: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  role: Role;
  createdAt: Date;
}

export function mapUserDoc(snap: FirebaseFirestore.DocumentSnapshot): UserDoc {
  const data = snap.data()!;
  return {
    id: snap.id,
    name: data.name,
    lastName: data.lastName ?? null,
    email: data.email,
    phone: data.phone ?? null,
    role: data.role,
    createdAt: data.createdAt.toDate(),
  };
}

export async function getUserByUid(uid: string): Promise<UserDoc | null> {
  const snap = await getAdminDb().collection(COLLECTIONS.users).doc(uid).get();
  return snap.exists ? mapUserDoc(snap) : null;
}

export async function createUser(
  uid: string,
  data: { name: string; lastName?: string; email: string; phone?: string; role: Role }
): Promise<void> {
  await getAdminDb()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .set({
      name: data.name,
      lastName: data.lastName ?? null,
      email: data.email,
      phone: data.phone ?? null,
      role: data.role,
      createdAt: new Date(),
    });
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Verificar contra Firestore real**

```bash
cat > /tmp/verify-task2.ts << 'EOF'
import "dotenv/config";
import { createUser, getUserByUid } from "./src/lib/db/users";
import { getAdminDb } from "./src/lib/firebase-admin";

async function main() {
  const uid = "__verify_task2__";
  await createUser(uid, { name: "Test", email: "test@example.com", role: "CLIENTE" });
  const user = await getUserByUid(uid);
  console.log("Usuario leído:", user);
  if (!user || user.name !== "Test" || user.role !== "CLIENTE") {
    throw new Error("Los datos leídos no coinciden con lo escrito");
  }
  await getAdminDb().collection("turnia_users").doc(uid).delete();
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
EOF
npx tsx /tmp/verify-task2.ts
```

Expected: imprime el usuario con `role: 'CLIENTE'` y `OK`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/users.ts
git commit -m "feat: add Firestore users data access"
```

---

## Task 3: `src/lib/db/hours.ts`

**Files:**
- Create: `src/lib/db/hours.ts`

**Interfaces:**
- Produces: `BusinessHourDoc`, `mapHourDoc(snap)`, `getHoursByBusiness(businessId)`, `hourRef(businessId, dayOfWeek)`, `upsertHours(businessId, days)`.

- [ ] **Step 1: Crear `src/lib/db/hours.ts`**

```ts
import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";

export interface BusinessHourDoc {
  businessId: string;
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

function hourDocId(businessId: string, dayOfWeek: number): string {
  return `${businessId}__${dayOfWeek}`;
}

export function mapHourDoc(snap: FirebaseFirestore.DocumentSnapshot): BusinessHourDoc {
  const data = snap.data()!;
  return {
    businessId: data.businessId,
    dayOfWeek: data.dayOfWeek,
    isClosed: data.isClosed,
    openTime: data.openTime ?? null,
    closeTime: data.closeTime ?? null,
  };
}

export async function getHoursByBusiness(businessId: string): Promise<BusinessHourDoc[]> {
  const snap = await getAdminDb()
    .collection(COLLECTIONS.businessHours)
    .where("businessId", "==", businessId)
    .get();
  const hours = snap.docs.map(mapHourDoc);
  hours.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  return hours;
}

// Doc ID determinístico: reproduce la constraint única de Prisma
// (@@unique([businessId, dayOfWeek])) como upsert natural vía set().
export function hourRef(businessId: string, dayOfWeek: number): FirebaseFirestore.DocumentReference {
  return getAdminDb().collection(COLLECTIONS.businessHours).doc(hourDocId(businessId, dayOfWeek));
}

export async function upsertHours(
  businessId: string,
  days: Omit<BusinessHourDoc, "businessId">[]
): Promise<void> {
  const batch = getAdminDb().batch();
  for (const day of days) {
    batch.set(hourRef(businessId, day.dayOfWeek), { businessId, ...day });
  }
  await batch.commit();
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Verificar contra Firestore real**

```bash
cat > /tmp/verify-task3.ts << 'EOF'
import "dotenv/config";
import { upsertHours, getHoursByBusiness } from "./src/lib/db/hours";
import { getAdminDb } from "./src/lib/firebase-admin";

async function main() {
  const businessId = "__verify_task3__";
  const days = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    isClosed: dayOfWeek === 0,
    openTime: dayOfWeek === 0 ? null : "10:00",
    closeTime: dayOfWeek === 0 ? null : "20:00",
  }));
  await upsertHours(businessId, days);
  // Correr upsert de nuevo con un cambio: debe pisar el mismo doc, no duplicar.
  await upsertHours(businessId, [{ ...days[1], openTime: "09:00" }]);
  const hours = await getHoursByBusiness(businessId);
  console.log("Horarios:", hours.length, hours.find((h) => h.dayOfWeek === 1));
  if (hours.length !== 7) throw new Error(`Esperaba 7 días, hay ${hours.length}`);
  if (hours.find((h) => h.dayOfWeek === 1)?.openTime !== "09:00") throw new Error("El upsert no pisó el doc existente");

  const batch = getAdminDb().batch();
  const db = getAdminDb();
  for (const day of days) {
    batch.delete(db.collection("turnia_businessHours").doc(`${businessId}__${day.dayOfWeek}`));
  }
  await batch.commit();
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
EOF
npx tsx /tmp/verify-task3.ts
```

Expected: `Horarios: 7 ...`, y `OK` (confirma que el upsert pisa el doc en vez de duplicar).

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/hours.ts
git commit -m "feat: add Firestore business hours data access"
```

---

## Task 4: `src/lib/db/businesses.ts`

**Files:**
- Create: `src/lib/db/businesses.ts`

**Interfaces:**
- Consumes: `hourRef` (Task 3).
- Produces: `BusinessDoc`, `mapBusinessDoc(snap)`, `getBusinessById`, `getBusinessBySlug`, `getBusinessByOwnerId`, `getPublishedBusinesses`, `isSlugTaken`, `updateBusiness`, `createBusinessOwnerBatch`.

- [ ] **Step 1: Crear `src/lib/db/businesses.ts`**

```ts
import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { hourRef } from "@/lib/db/hours";

export interface BusinessDoc {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  coverImage: string | null;
  published: boolean;
  ownerId: string;
  createdAt: Date;
}

export function mapBusinessDoc(snap: FirebaseFirestore.DocumentSnapshot): BusinessDoc {
  const data = snap.data()!;
  return {
    id: snap.id,
    slug: data.slug,
    name: data.name,
    category: data.category,
    description: data.description ?? null,
    address: data.address ?? null,
    phone: data.phone ?? null,
    whatsapp: data.whatsapp ?? null,
    coverImage: data.coverImage ?? null,
    published: data.published,
    ownerId: data.ownerId,
    createdAt: data.createdAt.toDate(),
  };
}

export async function getBusinessById(id: string): Promise<BusinessDoc | null> {
  const snap = await getAdminDb().collection(COLLECTIONS.businesses).doc(id).get();
  return snap.exists ? mapBusinessDoc(snap) : null;
}

export async function getBusinessBySlug(slug: string): Promise<BusinessDoc | null> {
  const snap = await getAdminDb()
    .collection(COLLECTIONS.businesses)
    .where("slug", "==", slug)
    .limit(1)
    .get();
  return snap.empty ? null : mapBusinessDoc(snap.docs[0]);
}

export async function getBusinessByOwnerId(ownerId: string): Promise<BusinessDoc | null> {
  const snap = await getAdminDb()
    .collection(COLLECTIONS.businesses)
    .where("ownerId", "==", ownerId)
    .limit(1)
    .get();
  return snap.empty ? null : mapBusinessDoc(snap.docs[0]);
}

export async function getPublishedBusinesses(
  opts: { category?: string; take?: number } = {}
): Promise<BusinessDoc[]> {
  let query: FirebaseFirestore.Query = getAdminDb()
    .collection(COLLECTIONS.businesses)
    .where("published", "==", true);
  if (opts.category) {
    query = query.where("category", "==", opts.category);
  }
  const snap = await query.get();
  const businesses = snap.docs.map(mapBusinessDoc);
  businesses.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return opts.take ? businesses.slice(0, opts.take) : businesses;
}

export async function isSlugTaken(slug: string): Promise<boolean> {
  const snap = await getAdminDb()
    .collection(COLLECTIONS.businesses)
    .where("slug", "==", slug)
    .limit(1)
    .get();
  return !snap.empty;
}

export async function updateBusiness(
  id: string,
  data: Partial<{
    name: string;
    category: string;
    description: string;
    address: string;
    phone: string;
    whatsapp: string;
    coverImage: string;
    published: boolean;
  }>
): Promise<void> {
  await getAdminDb().collection(COLLECTIONS.businesses).doc(id).update(data);
}

/**
 * Crea el usuario dueño + el negocio + sus 7 horarios en un solo batch atómico
 * (reemplaza el nested create de Prisma en registerBusiness).
 */
export async function createBusinessOwnerBatch(input: {
  ownerId: string;
  ownerData: { name: string; lastName?: string; email: string; phone?: string };
  businessData: {
    slug: string;
    name: string;
    category: string;
    description?: string;
    address?: string;
    phone?: string;
    whatsapp?: string;
  };
  hours: { dayOfWeek: number; isClosed: boolean; openTime: string | null; closeTime: string | null }[];
}): Promise<string> {
  const db = getAdminDb();
  const businessRef = db.collection(COLLECTIONS.businesses).doc();
  const batch = db.batch();

  batch.set(db.collection(COLLECTIONS.users).doc(input.ownerId), {
    name: input.ownerData.name,
    lastName: input.ownerData.lastName ?? null,
    email: input.ownerData.email,
    phone: input.ownerData.phone ?? null,
    role: "NEGOCIO",
    createdAt: new Date(),
  });

  batch.set(businessRef, {
    slug: input.businessData.slug,
    name: input.businessData.name,
    category: input.businessData.category,
    description: input.businessData.description ?? null,
    address: input.businessData.address ?? null,
    phone: input.businessData.phone ?? null,
    whatsapp: input.businessData.whatsapp ?? null,
    coverImage: null,
    published: true,
    ownerId: input.ownerId,
    createdAt: new Date(),
  });

  for (const day of input.hours) {
    batch.set(hourRef(businessRef.id, day.dayOfWeek), { businessId: businessRef.id, ...day });
  }

  await batch.commit();
  return businessRef.id;
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Verificar contra Firestore real**

```bash
cat > /tmp/verify-task4.ts << 'EOF'
import "dotenv/config";
import {
  createBusinessOwnerBatch,
  getBusinessBySlug,
  getBusinessByOwnerId,
  isSlugTaken,
  updateBusiness,
} from "./src/lib/db/businesses";
import { getHoursByBusiness } from "./src/lib/db/hours";
import { getAdminDb } from "./src/lib/firebase-admin";

async function main() {
  const ownerId = "__verify_task4_owner__";
  const businessId = await createBusinessOwnerBatch({
    ownerId,
    ownerData: { name: "Ana", email: "ana@example.com" },
    businessData: { slug: "negocio-de-prueba", name: "Negocio de Prueba", category: "spa" },
    hours: [{ dayOfWeek: 1, isClosed: false, openTime: "10:00", closeTime: "20:00" }],
  });

  const bySlug = await getBusinessBySlug("negocio-de-prueba");
  const byOwner = await getBusinessByOwnerId(ownerId);
  const taken = await isSlugTaken("negocio-de-prueba");
  const hours = await getHoursByBusiness(businessId);

  console.log({ bySlug: bySlug?.name, byOwner: byOwner?.id === businessId, taken, hoursCount: hours.length });
  if (bySlug?.id !== businessId || !taken || hours.length !== 1) {
    throw new Error("Los datos leídos no coinciden con lo escrito");
  }

  await updateBusiness(businessId, { name: "Negocio Actualizado" });
  const updated = await getBusinessBySlug("negocio-de-prueba");
  if (updated?.name !== "Negocio Actualizado") throw new Error("updateBusiness no aplicó el cambio");

  const db = getAdminDb();
  await db.collection("turnia_users").doc(ownerId).delete();
  await db.collection("turnia_businesses").doc(businessId).delete();
  await db.collection("turnia_businessHours").doc(`${businessId}__1`).delete();
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
EOF
npx tsx /tmp/verify-task4.ts
```

Expected: imprime el objeto con `taken: true`, `hoursCount: 1`, y `OK`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/businesses.ts
git commit -m "feat: add Firestore businesses data access"
```

---

## Task 5: `src/lib/db/services.ts` y `src/lib/db/professionals.ts`

**Files:**
- Create: `src/lib/db/services.ts`
- Create: `src/lib/db/professionals.ts`

**Interfaces:**
- Produces: `ServiceDoc`, `mapServiceDoc`, `getServicesByBusiness`, `getServicesForBusinesses`, `getServiceById`, `createService`, `updateService`; `ProfessionalDoc`, `mapProfessionalDoc`, `getProfessionalsByBusiness`, `getProfessionalById`, `createProfessional`, `updateProfessional`.

- [ ] **Step 1: Crear `src/lib/db/services.ts`**

```ts
import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";

export interface ServiceDoc {
  id: string;
  businessId: string;
  category: string;
  name: string;
  description: string | null;
  price: number;
  durationMin: number;
  active: boolean;
}

export function mapServiceDoc(snap: FirebaseFirestore.DocumentSnapshot): ServiceDoc {
  const data = snap.data()!;
  return {
    id: snap.id,
    businessId: data.businessId,
    category: data.category,
    name: data.name,
    description: data.description ?? null,
    price: data.price,
    durationMin: data.durationMin,
    active: data.active,
  };
}

export async function getServicesByBusiness(
  businessId: string,
  opts: { activeOnly?: boolean } = {}
): Promise<ServiceDoc[]> {
  let query: FirebaseFirestore.Query = getAdminDb()
    .collection(COLLECTIONS.services)
    .where("businessId", "==", businessId);
  if (opts.activeOnly) query = query.where("active", "==", true);
  const snap = await query.get();
  const services = snap.docs.map(mapServiceDoc);
  services.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  return services;
}

// Usado por la búsqueda de texto del marketplace (hasta 30 ids por query 'in').
export async function getServicesForBusinesses(businessIds: string[]): Promise<ServiceDoc[]> {
  if (businessIds.length === 0) return [];
  const db = getAdminDb();
  const chunks: string[][] = [];
  for (let i = 0; i < businessIds.length; i += 30) {
    chunks.push(businessIds.slice(i, i + 30));
  }
  const results = await Promise.all(
    chunks.map((chunk) => db.collection(COLLECTIONS.services).where("businessId", "in", chunk).get())
  );
  return results.flatMap((snap) => snap.docs.map(mapServiceDoc));
}

export async function getServiceById(id: string): Promise<ServiceDoc | null> {
  const snap = await getAdminDb().collection(COLLECTIONS.services).doc(id).get();
  return snap.exists ? mapServiceDoc(snap) : null;
}

export async function createService(
  businessId: string,
  data: { category: string; name: string; description?: string; price: number; durationMin: number }
): Promise<void> {
  await getAdminDb()
    .collection(COLLECTIONS.services)
    .add({
      businessId,
      category: data.category,
      name: data.name,
      description: data.description ?? null,
      price: data.price,
      durationMin: data.durationMin,
      active: true,
    });
}

export async function updateService(
  id: string,
  data: Partial<{
    category: string;
    name: string;
    description: string;
    price: number;
    durationMin: number;
    active: boolean;
  }>
): Promise<void> {
  await getAdminDb().collection(COLLECTIONS.services).doc(id).update(data);
}
```

- [ ] **Step 2: Crear `src/lib/db/professionals.ts`**

```ts
import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";

export interface ProfessionalDoc {
  id: string;
  businessId: string;
  name: string;
  photo: string | null;
  active: boolean;
}

export function mapProfessionalDoc(snap: FirebaseFirestore.DocumentSnapshot): ProfessionalDoc {
  const data = snap.data()!;
  return {
    id: snap.id,
    businessId: data.businessId,
    name: data.name,
    photo: data.photo ?? null,
    active: data.active,
  };
}

export async function getProfessionalsByBusiness(
  businessId: string,
  opts: { activeOnly?: boolean } = {}
): Promise<ProfessionalDoc[]> {
  let query: FirebaseFirestore.Query = getAdminDb()
    .collection(COLLECTIONS.professionals)
    .where("businessId", "==", businessId);
  if (opts.activeOnly) query = query.where("active", "==", true);
  const snap = await query.get();
  const professionals = snap.docs.map(mapProfessionalDoc);
  professionals.sort((a, b) => a.name.localeCompare(b.name));
  return professionals;
}

export async function getProfessionalById(id: string): Promise<ProfessionalDoc | null> {
  const snap = await getAdminDb().collection(COLLECTIONS.professionals).doc(id).get();
  return snap.exists ? mapProfessionalDoc(snap) : null;
}

export async function createProfessional(businessId: string, data: { name: string }): Promise<void> {
  await getAdminDb().collection(COLLECTIONS.professionals).add({
    businessId,
    name: data.name,
    photo: null,
    active: true,
  });
}

export async function updateProfessional(
  id: string,
  data: Partial<{ name: string; active: boolean }>
): Promise<void> {
  await getAdminDb().collection(COLLECTIONS.professionals).doc(id).update(data);
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 4: Verificar contra Firestore real**

```bash
cat > /tmp/verify-task5.ts << 'EOF'
import "dotenv/config";
import { createService, getServicesByBusiness, getServicesForBusinesses, updateService } from "./src/lib/db/services";
import { createProfessional, getProfessionalsByBusiness, updateProfessional } from "./src/lib/db/professionals";
import { getAdminDb } from "./src/lib/firebase-admin";

async function main() {
  const businessId = "__verify_task5__";
  await createService(businessId, { category: "Corte", name: "Corte Test", price: 1000, durationMin: 30 });
  await createProfessional(businessId, { name: "Profesional Test" });

  const services = await getServicesByBusiness(businessId);
  const professionals = await getProfessionalsByBusiness(businessId);
  console.log({ services: services.length, professionals: professionals.length });
  if (services.length !== 1 || professionals.length !== 1) throw new Error("No se crearon los docs esperados");

  const viaBatch = await getServicesForBusinesses([businessId]);
  if (viaBatch.length !== 1) throw new Error("getServicesForBusinesses no encontró el servicio");

  await updateService(services[0].id, { active: false });
  await updateProfessional(professionals[0].id, { active: false });
  const afterUpdate = await getServicesByBusiness(businessId, { activeOnly: true });
  if (afterUpdate.length !== 0) throw new Error("updateService/activeOnly no filtró correctamente");

  const db = getAdminDb();
  await db.collection("turnia_services").doc(services[0].id).delete();
  await db.collection("turnia_professionals").doc(professionals[0].id).delete();
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
EOF
npx tsx /tmp/verify-task5.ts
```

Expected: `{ services: 1, professionals: 1 }`, luego `OK`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/services.ts src/lib/db/professionals.ts
git commit -m "feat: add Firestore services and professionals data access"
```

---

## Task 6: `src/lib/db/appointments.ts`

**Files:**
- Create: `src/lib/db/appointments.ts`

**Interfaces:**
- Consumes: `mapBusinessDoc`/`BusinessDoc` (Task 4), `mapServiceDoc`/`ServiceDoc` (Task 5), `mapProfessionalDoc`/`ProfessionalDoc` (Task 5), `mapUserDoc`/`UserDoc` (Task 2), `generateAvailableSlots`/`BusinessHourLike` (`src/lib/slots.ts`, sin cambios).
- Produces: `AppointmentDoc`, `AppointmentStatus`, `mapAppointmentDoc`, `getAppointmentsInRange`, `getAppointmentsForClient`, `getAppointmentById`, `getDueReminders`, `markReminderSent`, `updateAppointmentStatus`, `createAppointmentDoc` (escritura directa, sin chequeo — usada por el seed), `createAppointmentTx` (transaccional con re-chequeo de disponibilidad — usada por la reserva real), `SlotUnavailableError`, `hydrateForClient`, `hydrateForBusiness`, `ClientAppointmentView`, `BusinessAppointmentView`.

- [ ] **Step 1: Crear `src/lib/db/appointments.ts`**

```ts
import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/db/collections";
import { mapBusinessDoc, type BusinessDoc } from "@/lib/db/businesses";
import { mapServiceDoc, type ServiceDoc } from "@/lib/db/services";
import { mapProfessionalDoc, type ProfessionalDoc } from "@/lib/db/professionals";
import { mapUserDoc, type UserDoc } from "@/lib/db/users";
import { generateAvailableSlots, type BusinessHourLike } from "@/lib/slots";

export type AppointmentStatus = "PENDIENTE" | "CONFIRMADO" | "CANCELADO" | "COMPLETADO";

export interface AppointmentDoc {
  id: string;
  businessId: string;
  professionalId: string;
  serviceId: string;
  clientId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  notes: string | null;
  reminderSent: boolean;
  createdAt: Date;
}

export function mapAppointmentDoc(snap: FirebaseFirestore.DocumentSnapshot): AppointmentDoc {
  const data = snap.data()!;
  return {
    id: snap.id,
    businessId: data.businessId,
    professionalId: data.professionalId,
    serviceId: data.serviceId,
    clientId: data.clientId,
    startsAt: data.startsAt.toDate(),
    endsAt: data.endsAt.toDate(),
    status: data.status,
    notes: data.notes ?? null,
    reminderSent: data.reminderSent,
    createdAt: data.createdAt.toDate(),
  };
}

export async function getAppointmentsInRange(
  businessId: string,
  start: Date,
  end: Date
): Promise<AppointmentDoc[]> {
  const snap = await getAdminDb()
    .collection(COLLECTIONS.appointments)
    .where("businessId", "==", businessId)
    .where("startsAt", ">=", start)
    .where("startsAt", "<=", end)
    .get();
  const appointments = snap.docs.map(mapAppointmentDoc);
  appointments.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return appointments;
}

export async function getAppointmentsForClient(clientId: string): Promise<AppointmentDoc[]> {
  const snap = await getAdminDb()
    .collection(COLLECTIONS.appointments)
    .where("clientId", "==", clientId)
    .get();
  const appointments = snap.docs.map(mapAppointmentDoc);
  appointments.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  return appointments;
}

export async function getAppointmentById(id: string): Promise<AppointmentDoc | null> {
  const snap = await getAdminDb().collection(COLLECTIONS.appointments).doc(id).get();
  return snap.exists ? mapAppointmentDoc(snap) : null;
}

// Un solo filtro de rango (sin igualdad combinada) para no necesitar índice compuesto.
export async function getDueReminders(windowStart: Date, windowEnd: Date): Promise<AppointmentDoc[]> {
  const snap = await getAdminDb()
    .collection(COLLECTIONS.appointments)
    .where("startsAt", ">=", windowStart)
    .where("startsAt", "<=", windowEnd)
    .get();
  return snap.docs
    .map(mapAppointmentDoc)
    .filter((a) => !a.reminderSent && (a.status === "CONFIRMADO" || a.status === "PENDIENTE"));
}

export async function markReminderSent(id: string): Promise<void> {
  await getAdminDb().collection(COLLECTIONS.appointments).doc(id).update({ reminderSent: true });
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<void> {
  await getAdminDb().collection(COLLECTIONS.appointments).doc(id).update({ status });
}

/** Escritura directa, sin re-chequeo de disponibilidad. Sólo para el seed script. */
export async function createAppointmentDoc(data: {
  businessId: string;
  professionalId: string;
  serviceId: string;
  clientId: string;
  startsAt: Date;
  endsAt: Date;
  status?: AppointmentStatus;
  notes?: string;
}): Promise<AppointmentDoc> {
  const ref = getAdminDb().collection(COLLECTIONS.appointments).doc();
  const doc = {
    businessId: data.businessId,
    professionalId: data.professionalId,
    serviceId: data.serviceId,
    clientId: data.clientId,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    status: data.status ?? ("CONFIRMADO" as AppointmentStatus),
    notes: data.notes ?? null,
    reminderSent: false,
    createdAt: new Date(),
  };
  await ref.set(doc);
  return { id: ref.id, ...doc };
}

export class SlotUnavailableError extends Error {}

/**
 * Crea el turno dentro de una transacción: vuelve a chequear disponibilidad
 * contra los turnos que pisan el horario del profesional elegido ese día, y
 * sólo escribe si el slot sigue libre. Usada por la reserva real (bookings.ts).
 */
export async function createAppointmentTx(input: {
  businessId: string;
  professionalId: string;
  serviceId: string;
  clientId: string;
  startsAt: Date;
  endsAt: Date;
  durationMin: number;
  businessHours: BusinessHourLike[];
  notes?: string;
}): Promise<AppointmentDoc> {
  const db = getAdminDb();
  const dayStart = new Date(input.startsAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(input.startsAt);
  dayEnd.setHours(23, 59, 59, 999);

  const newRef = db.collection(COLLECTIONS.appointments).doc();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(
      db
        .collection(COLLECTIONS.appointments)
        .where("businessId", "==", input.businessId)
        .where("startsAt", ">=", dayStart)
        .where("startsAt", "<=", dayEnd)
    );

    const busy = snap.docs
      .map(mapAppointmentDoc)
      .filter(
        (a) =>
          a.professionalId === input.professionalId &&
          (a.status === "PENDIENTE" || a.status === "CONFIRMADO")
      );

    const slots = generateAvailableSlots({
      date: dayStart,
      durationMin: input.durationMin,
      businessHours: input.businessHours,
      busyRanges: busy,
    });

    if (!slots.some((s) => s.getTime() === input.startsAt.getTime())) {
      throw new SlotUnavailableError("Ese horario ya no está disponible.");
    }

    const doc = {
      businessId: input.businessId,
      professionalId: input.professionalId,
      serviceId: input.serviceId,
      clientId: input.clientId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: "CONFIRMADO" as AppointmentStatus,
      notes: input.notes ?? null,
      reminderSent: false,
      createdAt: new Date(),
    };
    tx.create(newRef, doc);
    return { id: newRef.id, ...doc };
  });
}

export interface ClientAppointmentView extends AppointmentDoc {
  business: BusinessDoc;
  service: ServiceDoc;
  professional: ProfessionalDoc;
}

/** Hidrata turnos con negocio + servicio + profesional (usado en /mis-turnos). */
export async function hydrateForClient(appointments: AppointmentDoc[]): Promise<ClientAppointmentView[]> {
  if (appointments.length === 0) return [];
  const db = getAdminDb();
  const businessIds = [...new Set(appointments.map((a) => a.businessId))];
  const serviceIds = [...new Set(appointments.map((a) => a.serviceId))];
  const professionalIds = [...new Set(appointments.map((a) => a.professionalId))];

  const [businessSnaps, serviceSnaps, professionalSnaps] = await Promise.all([
    db.getAll(...businessIds.map((id) => db.collection(COLLECTIONS.businesses).doc(id))),
    db.getAll(...serviceIds.map((id) => db.collection(COLLECTIONS.services).doc(id))),
    db.getAll(...professionalIds.map((id) => db.collection(COLLECTIONS.professionals).doc(id))),
  ]);

  const businesses = new Map(businessSnaps.filter((s) => s.exists).map((s) => [s.id, mapBusinessDoc(s)]));
  const services = new Map(serviceSnaps.filter((s) => s.exists).map((s) => [s.id, mapServiceDoc(s)]));
  const professionals = new Map(
    professionalSnaps.filter((s) => s.exists).map((s) => [s.id, mapProfessionalDoc(s)])
  );

  const out: ClientAppointmentView[] = [];
  for (const a of appointments) {
    const business = businesses.get(a.businessId);
    const service = services.get(a.serviceId);
    const professional = professionals.get(a.professionalId);
    if (!business || !service || !professional) continue;
    out.push({ ...a, business, service, professional });
  }
  return out;
}

export interface BusinessAppointmentView extends AppointmentDoc {
  service: ServiceDoc;
  professional: ProfessionalDoc;
  client: UserDoc;
}

/** Hidrata turnos con servicio + profesional + cliente (usado en /panel/agenda y /panel). */
export async function hydrateForBusiness(appointments: AppointmentDoc[]): Promise<BusinessAppointmentView[]> {
  if (appointments.length === 0) return [];
  const db = getAdminDb();
  const serviceIds = [...new Set(appointments.map((a) => a.serviceId))];
  const professionalIds = [...new Set(appointments.map((a) => a.professionalId))];
  const clientIds = [...new Set(appointments.map((a) => a.clientId))];

  const [serviceSnaps, professionalSnaps, clientSnaps] = await Promise.all([
    db.getAll(...serviceIds.map((id) => db.collection(COLLECTIONS.services).doc(id))),
    db.getAll(...professionalIds.map((id) => db.collection(COLLECTIONS.professionals).doc(id))),
    db.getAll(...clientIds.map((id) => db.collection(COLLECTIONS.users).doc(id))),
  ]);

  const services = new Map(serviceSnaps.filter((s) => s.exists).map((s) => [s.id, mapServiceDoc(s)]));
  const professionals = new Map(
    professionalSnaps.filter((s) => s.exists).map((s) => [s.id, mapProfessionalDoc(s)])
  );
  const clients = new Map(clientSnaps.filter((s) => s.exists).map((s) => [s.id, mapUserDoc(s)]));

  const out: BusinessAppointmentView[] = [];
  for (const a of appointments) {
    const service = services.get(a.serviceId);
    const professional = professionals.get(a.professionalId);
    const client = clients.get(a.clientId);
    if (!service || !professional || !client) continue;
    out.push({ ...a, service, professional, client });
  }
  return out;
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Verificar contra Firestore real (incluye el caso de conflicto de horario)**

```bash
cat > /tmp/verify-task6.ts << 'EOF'
import "dotenv/config";
import { createBusinessOwnerBatch } from "./src/lib/db/businesses";
import { createService } from "./src/lib/db/services";
import { createProfessional, getProfessionalsByBusiness } from "./src/lib/db/professionals";
import { getServicesByBusiness } from "./src/lib/db/services";
import { getHoursByBusiness } from "./src/lib/db/hours";
import {
  createAppointmentTx,
  getAppointmentsInRange,
  hydrateForClient,
  hydrateForBusiness,
  SlotUnavailableError,
} from "./src/lib/db/appointments";
import { getAdminDb } from "./src/lib/firebase-admin";

async function main() {
  const ownerId = "__verify_task6_owner__";
  const clientId = "__verify_task6_client__";
  const businessId = await createBusinessOwnerBatch({
    ownerId,
    ownerData: { name: "Dueño", email: "owner@example.com" },
    businessData: { slug: "negocio-turnos-test", name: "Negocio Turnos Test", category: "spa" },
    hours: [{ dayOfWeek: 1, isClosed: false, openTime: "10:00", closeTime: "20:00" }],
  });
  await createService(businessId, { category: "Test", name: "Servicio Test", price: 1000, durationMin: 30 });
  await createProfessional(businessId, { name: "Profesional Test" });

  const services = await getServicesByBusiness(businessId);
  const professionals = await getProfessionalsByBusiness(businessId);
  const hours = await getHoursByBusiness(businessId);

  // Próximo lunes a las 11:00.
  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + ((1 + 7 - startsAt.getDay()) % 7 || 7));
  startsAt.setHours(11, 0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 30 * 60000);

  const appt = await createAppointmentTx({
    businessId,
    professionalId: professionals[0].id,
    serviceId: services[0].id,
    clientId,
    startsAt,
    endsAt,
    durationMin: 30,
    businessHours: hours,
  });
  console.log("Turno creado:", appt.id);

  let conflictDetected = false;
  try {
    await createAppointmentTx({
      businessId,
      professionalId: professionals[0].id,
      serviceId: services[0].id,
      clientId,
      startsAt,
      endsAt,
      durationMin: 30,
      businessHours: hours,
    });
  } catch (e) {
    if (e instanceof SlotUnavailableError) conflictDetected = true;
    else throw e;
  }
  if (!conflictDetected) throw new Error("La transacción no detectó el conflicto de horario");
  console.log("Conflicto detectado correctamente");

  const dayStart = new Date(startsAt);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(startsAt);
  dayEnd.setHours(23, 59, 59, 999);
  const inRange = await getAppointmentsInRange(businessId, dayStart, dayEnd);
  const clientView = await hydrateForClient(inRange.filter((a) => a.clientId === clientId));
  const businessView = await hydrateForBusiness(inRange);
  console.log({ clientView: clientView[0]?.business.name, businessView: businessView[0]?.client.id });
  if (clientView[0]?.business.name !== "Negocio Turnos Test") throw new Error("hydrateForClient no trajo el negocio");
  if (businessView[0]?.client.id !== clientId) throw new Error("hydrateForBusiness no trajo el cliente");

  const db = getAdminDb();
  await db.collection("turnia_users").doc(ownerId).delete();
  await db.collection("turnia_businesses").doc(businessId).delete();
  await db.collection("turnia_businessHours").doc(`${businessId}__1`).delete();
  await db.collection("turnia_services").doc(services[0].id).delete();
  await db.collection("turnia_professionals").doc(professionals[0].id).delete();
  await db.collection("turnia_appointments").doc(appt.id).delete();
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
EOF
npx tsx /tmp/verify-task6.ts
```

Expected: `Turno creado: ...`, `Conflicto detectado correctamente`, el objeto con los nombres correctos, y `OK`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/appointments.ts
git commit -m "feat: add Firestore appointments data access with transactional booking"
```

---

## Task 7: Reescribir `src/lib/session.ts`

**Files:**
- Modify: `src/lib/session.ts` (todo el archivo)

**Interfaces:**
- Consumes: `getUserByUid` (Task 2), `getBusinessByOwnerId` (Task 4).
- Produces: mismas firmas que hoy — `getCurrentUser()`, `requireBusinessUser()`, `requireClientUser()` (sin cambios para quien las consume).

- [ ] **Step 1: Reemplazar el contenido completo de `src/lib/session.ts`**

```ts
import { cookies } from "next/headers";
import { getAdminAuth } from "./firebase-admin";
import { getUserByUid } from "./db/users";
import { getBusinessByOwnerId } from "./db/businesses";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE_MS } from "./session-constants";

export { SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE_MS };

/** Usuario autenticado actual (con su negocio, si es dueño de uno), o null si no hay sesión válida. */
export async function getCurrentUser() {
  const sessionCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const user = await getUserByUid(decoded.uid);
    if (!user) return null;
    const business = await getBusinessByOwnerId(user.id);
    return { ...user, business };
  } catch {
    return null;
  }
}

/** Devuelve el usuario sólo si es dueño de un negocio (rol NEGOCIO con business asociado). */
export async function requireBusinessUser() {
  const user = await getCurrentUser();
  if (!user || user.role !== "NEGOCIO" || !user.business) return null;
  return user;
}

/** Devuelve el usuario sólo si es un cliente. */
export async function requireClientUser() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CLIENTE") return null;
  return user;
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: errores restantes deberían ser sólo en archivos que todavía no se migraron en tareas posteriores (`src/actions/*`, páginas) — no en `session.ts` en sí.

- [ ] **Step 3: Commit**

```bash
git add src/lib/session.ts
git commit -m "refactor: rewrite session.ts to read from Firestore"
```

---

## Task 8: Reescribir `src/actions/auth.ts`

**Files:**
- Modify: `src/actions/auth.ts` (todo el archivo)

**Interfaces:**
- Consumes: `getUserByUid`, `createUser` (Task 2), `isSlugTaken`, `createBusinessOwnerBatch` (Task 4).
- Produces: mismas firmas — `registerClient(input)`, `registerBusiness(input)`.

- [ ] **Step 1: Reemplazar el contenido completo de `src/actions/auth.ts`**

```ts
"use server";

import { z } from "zod";
import { getAdminAuth } from "@/lib/firebase-admin";
import { createUser, getUserByUid } from "@/lib/db/users";
import { isSlugTaken, createBusinessOwnerBatch } from "@/lib/db/businesses";

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
  while (await isSlugTaken(slug)) {
    slug = `${baseSlug}-${i++}`;
  }

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
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores en `src/actions/auth.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/actions/auth.ts
git commit -m "refactor: rewrite auth actions to write to Firestore"
```

---

## Task 9: Reescribir `src/actions/business.ts` y `src/actions/hours.ts`

**Files:**
- Modify: `src/actions/business.ts` (todo el archivo)
- Modify: `src/actions/hours.ts` (todo el archivo)

**Interfaces:**
- Consumes: `updateBusiness` (Task 4), `upsertHours` (Task 3), `requireBusinessUser` (Task 7).
- Produces: mismas firmas — `updateBusinessProfile(input)`, `updateBusinessHours(input)`.

- [ ] **Step 1: Reemplazar el contenido completo de `src/actions/business.ts`**

```ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { updateBusiness } from "@/lib/db/businesses";
import { requireBusinessUser } from "@/lib/session";
import { CATEGORIES } from "@/lib/config";

export type ActionResult = { ok: true } | { ok: false; error: string };

const profileSchema = z.object({
  name: z.string().min(2, "Ingresá el nombre del negocio"),
  category: z.enum(CATEGORIES.map((c) => c.slug) as [string, ...string[]]),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  coverImage: z.string().optional(),
  published: z.boolean(),
});

export async function updateBusinessProfile(input: unknown): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  await updateBusiness(user.business!.id, parsed.data);

  revalidatePath("/panel/negocio");
  revalidatePath("/negocios");
  revalidatePath(`/negocios/${user.business!.slug}`);
  return { ok: true };
}
```

- [ ] **Step 2: Reemplazar el contenido completo de `src/actions/hours.ts`**

```ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { upsertHours } from "@/lib/db/hours";
import { requireBusinessUser } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const hourSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isClosed: z.boolean(),
  openTime: z.string().nullable(),
  closeTime: z.string().nullable(),
});

const hoursSchema = z.array(hourSchema).length(7);

export async function updateBusinessHours(input: unknown): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const parsed = hoursSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos de horario inválidos." };

  for (const day of parsed.data) {
    if (!day.isClosed && (!day.openTime || !day.closeTime)) {
      return { ok: false, error: "Completá el horario de apertura y cierre de todos los días abiertos." };
    }
    if (!day.isClosed && day.openTime! >= day.closeTime!) {
      return { ok: false, error: "El horario de cierre debe ser posterior al de apertura." };
    }
  }

  await upsertHours(user.business!.id, parsed.data);

  revalidatePath("/panel/horarios");
  revalidatePath("/negocios");
  return { ok: true };
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores en estos dos archivos.

- [ ] **Step 4: Commit**

```bash
git add src/actions/business.ts src/actions/hours.ts
git commit -m "refactor: rewrite business profile and hours actions to write to Firestore"
```

---

## Task 10: Reescribir `src/actions/professionals.ts` y `src/actions/services.ts`

**Files:**
- Modify: `src/actions/professionals.ts` (todo el archivo)
- Modify: `src/actions/services.ts` (todo el archivo)

**Interfaces:**
- Consumes: `createProfessional`, `updateProfessional`, `getProfessionalById`, `createService`, `updateService`, `getServiceById` (Task 5), `requireBusinessUser` (Task 7).
- Produces: mismas firmas que hoy en ambos archivos.

- [ ] **Step 1: Reemplazar el contenido completo de `src/actions/professionals.ts`**

```ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  createProfessional as createProfessionalDoc,
  updateProfessional as updateProfessionalDoc,
  getProfessionalById,
} from "@/lib/db/professionals";
import { requireBusinessUser } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const professionalSchema = z.object({
  name: z.string().min(1, "Ingresá un nombre"),
});

export async function createProfessional(input: unknown): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const parsed = professionalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  await createProfessionalDoc(user.business!.id, parsed.data);

  revalidatePath("/panel/profesionales");
  return { ok: true };
}

export async function updateProfessional(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const existing = await getProfessionalById(id);
  if (!existing || existing.businessId !== user.business!.id) {
    return { ok: false, error: "No encontramos ese profesional." };
  }

  const parsed = professionalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  await updateProfessionalDoc(id, parsed.data);
  revalidatePath("/panel/profesionales");
  return { ok: true };
}

export async function setProfessionalActive(id: string, active: boolean): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const existing = await getProfessionalById(id);
  if (!existing || existing.businessId !== user.business!.id) {
    return { ok: false, error: "No encontramos ese profesional." };
  }

  await updateProfessionalDoc(id, { active });
  revalidatePath("/panel/profesionales");
  return { ok: true };
}
```

- [ ] **Step 2: Reemplazar el contenido completo de `src/actions/services.ts`**

```ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  createService as createServiceDoc,
  updateService as updateServiceDoc,
  getServiceById,
} from "@/lib/db/services";
import { requireBusinessUser } from "@/lib/session";

export type ActionResult = { ok: true } | { ok: false; error: string };

const serviceSchema = z.object({
  category: z.string().min(1, "Ingresá una categoría"),
  name: z.string().min(1, "Ingresá un nombre"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "El precio no puede ser negativo"),
  durationMin: z.coerce.number().int().min(5, "La duración mínima es 5 minutos"),
});

export async function createService(input: unknown): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  await createServiceDoc(user.business!.id, parsed.data);

  revalidatePath("/panel/servicios");
  revalidatePath("/negocios");
  return { ok: true };
}

export async function updateService(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const existing = await getServiceById(id);
  if (!existing || existing.businessId !== user.business!.id) {
    return { ok: false, error: "No encontramos ese servicio." };
  }

  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  await updateServiceDoc(id, parsed.data);
  revalidatePath("/panel/servicios");
  revalidatePath("/negocios");
  return { ok: true };
}

export async function setServiceActive(id: string, active: boolean): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const existing = await getServiceById(id);
  if (!existing || existing.businessId !== user.business!.id) {
    return { ok: false, error: "No encontramos ese servicio." };
  }

  await updateServiceDoc(id, { active });
  revalidatePath("/panel/servicios");
  revalidatePath("/negocios");
  return { ok: true };
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores en estos dos archivos.

- [ ] **Step 4: Commit**

```bash
git add src/actions/professionals.ts src/actions/services.ts
git commit -m "refactor: rewrite professionals and services actions to write to Firestore"
```

---

## Task 11: Reescribir `src/actions/bookings.ts`

**Files:**
- Modify: `src/actions/bookings.ts` (todo el archivo)

**Interfaces:**
- Consumes: `getCurrentUser`, `requireBusinessUser` (Task 7); `getBusinessById` (Task 4); `getHoursByBusiness` (Task 3); `getProfessionalsByBusiness` (Task 5); `getServiceById` (Task 5); `getUserByUid` (Task 2); `getAppointmentsInRange`, `getAppointmentById`, `createAppointmentTx`, `updateAppointmentStatus`, `SlotUnavailableError` (Task 6); `generateAvailableSlots` (`src/lib/slots.ts`, sin cambios).
- Produces: mismas firmas — `getAvailableSlots(input)`, `createAppointment(input)`, `cancelAppointmentAsClient(id)`, `updateAppointmentStatusAsBusiness(id, status)`.

**Nota de diseño:** el email de confirmación al cliente ahora usa `user.email`/`user.name` (ya lo devuelve `getCurrentUser()` al principio de la función) en vez de re-leer el turno con el cliente incluido — es la misma persona, evita una lectura redundante.

- [ ] **Step 1: Reemplazar el contenido completo de `src/actions/bookings.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireBusinessUser } from "@/lib/session";
import { getUserByUid } from "@/lib/db/users";
import { getBusinessById } from "@/lib/db/businesses";
import { getHoursByBusiness } from "@/lib/db/hours";
import { getProfessionalsByBusiness } from "@/lib/db/professionals";
import { getServiceById } from "@/lib/db/services";
import {
  getAppointmentsInRange,
  getAppointmentById,
  createAppointmentTx,
  updateAppointmentStatus,
  SlotUnavailableError,
} from "@/lib/db/appointments";
import { generateAvailableSlots } from "@/lib/slots";
import { sendMail, bookingConfirmationEmail, newBookingOwnerEmail } from "@/lib/mailer";
import { formatDateLong, formatTime } from "@/lib/format";

export type ActionResult = { ok: true } | { ok: false; error: string };

function dayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Devuelve, para un negocio/servicio/fecha dados, los horarios libres por profesional. */
export async function getAvailableSlots({
  businessId,
  serviceId,
  professionalId,
  dateISO,
}: {
  businessId: string;
  serviceId: string;
  professionalId: string; // "any" o el id de un profesional puntual
  dateISO: string; // "yyyy-MM-dd"
}) {
  const [business, service, businessHours, allProfessionals] = await Promise.all([
    getBusinessById(businessId),
    getServiceById(serviceId),
    getHoursByBusiness(businessId),
    getProfessionalsByBusiness(businessId, { activeOnly: true }),
  ]);

  if (!business || !service) {
    return { professionals: [] as { id: string; name: string }[], slotsByProfessional: {} as Record<string, string[]> };
  }

  const date = new Date(`${dateISO}T00:00:00`);
  const candidates =
    professionalId === "any"
      ? allProfessionals
      : allProfessionals.filter((p) => p.id === professionalId);

  const { start, end } = dayRange(date);
  const appointments = await getAppointmentsInRange(businessId, start, end);
  const relevant = appointments.filter((a) => a.status === "PENDIENTE" || a.status === "CONFIRMADO");

  const slotsByProfessional: Record<string, string[]> = {};
  for (const prof of candidates) {
    const busy = relevant.filter((a) => a.professionalId === prof.id);
    const slots = generateAvailableSlots({
      date,
      durationMin: service.durationMin,
      businessHours,
      busyRanges: busy,
    });
    slotsByProfessional[prof.id] = slots.map(
      (s) => `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`
    );
  }

  return {
    professionals: candidates.map((p) => ({ id: p.id, name: p.name })),
    slotsByProfessional,
  };
}

/** Crea el turno, revalidando disponibilidad en una transacción de Firestore para evitar choques. */
export async function createAppointment(input: {
  businessId: string;
  serviceId: string;
  professionalId: string;
  dateISO: string;
  time: string;
  notes?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "AUTH_REQUIRED" };
  }
  if (user.role !== "CLIENTE") {
    return { ok: false, error: "Ingresá con una cuenta de cliente para reservar." };
  }

  const [business, service, businessHours, allProfessionals] = await Promise.all([
    getBusinessById(input.businessId),
    getServiceById(input.serviceId),
    getHoursByBusiness(input.businessId),
    getProfessionalsByBusiness(input.businessId, { activeOnly: true }),
  ]);

  if (!business || !service) {
    return { ok: false, error: "No encontramos el negocio o el servicio." };
  }

  const owner = await getUserByUid(business.ownerId);
  if (!owner) {
    return { ok: false, error: "No encontramos el negocio o el servicio." };
  }

  const date = new Date(`${input.dateISO}T00:00:00`);
  const [hh, mm] = input.time.split(":").map(Number);
  const startsAt = new Date(date);
  startsAt.setHours(hh, mm, 0, 0);
  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60000);

  const candidates =
    input.professionalId === "any"
      ? allProfessionals
      : allProfessionals.filter((p) => p.id === input.professionalId);

  if (candidates.length === 0) {
    return { ok: false, error: "No hay profesionales disponibles para ese servicio." };
  }

  const { start, end } = dayRange(date);
  const existing = await getAppointmentsInRange(input.businessId, start, end);
  const relevant = existing.filter((a) => a.status === "PENDIENTE" || a.status === "CONFIRMADO");

  let chosenProfessional: { id: string; name: string } | null = null;
  for (const prof of candidates) {
    const busy = relevant.filter((a) => a.professionalId === prof.id);
    const slots = generateAvailableSlots({
      date,
      durationMin: service.durationMin,
      businessHours,
      busyRanges: busy,
    });
    if (slots.some((s) => s.getTime() === startsAt.getTime())) {
      chosenProfessional = prof;
      break;
    }
  }

  if (!chosenProfessional) {
    return { ok: false, error: "Ese horario ya no está disponible. Elegí otro." };
  }

  try {
    await createAppointmentTx({
      businessId: business.id,
      professionalId: chosenProfessional.id,
      serviceId: service.id,
      clientId: user.id,
      startsAt,
      endsAt,
      durationMin: service.durationMin,
      businessHours,
      notes: input.notes,
    });
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      return { ok: false, error: "Ese horario ya no está disponible. Elegí otro." };
    }
    throw err;
  }

  try {
    await sendMail({
      to: user.email,
      subject: `Turno confirmado en ${business.name}`,
      html: bookingConfirmationEmail({
        clientName: user.name,
        businessName: business.name,
        serviceName: service.name,
        professionalName: chosenProfessional.name,
        dateLabel: formatDateLong(startsAt),
        timeLabel: formatTime(startsAt),
        address: business.address,
      }),
    });

    await sendMail({
      to: owner.email,
      subject: `Nuevo turno de ${user.name}`,
      html: newBookingOwnerEmail({
        businessName: business.name,
        clientName: user.name,
        serviceName: service.name,
        professionalName: chosenProfessional.name,
        dateLabel: formatDateLong(startsAt),
        timeLabel: formatTime(startsAt),
      }),
    });
  } catch (err) {
    console.error("No se pudo enviar el email de confirmación", err);
  }

  revalidatePath("/mis-turnos");
  revalidatePath("/panel/agenda");

  return { ok: true };
}

export async function cancelAppointmentAsClient(appointmentId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "AUTH_REQUIRED" };

  const appointment = await getAppointmentById(appointmentId);
  if (!appointment || appointment.clientId !== user.id) {
    return { ok: false, error: "No encontramos ese turno." };
  }

  await updateAppointmentStatus(appointmentId, "CANCELADO");

  revalidatePath("/mis-turnos");
  revalidatePath("/panel/agenda");
  return { ok: true };
}

export async function updateAppointmentStatusAsBusiness(
  appointmentId: string,
  status: "CONFIRMADO" | "CANCELADO" | "COMPLETADO"
): Promise<ActionResult> {
  const user = await requireBusinessUser();
  if (!user) {
    return { ok: false, error: "AUTH_REQUIRED" };
  }

  const appointment = await getAppointmentById(appointmentId);
  if (!appointment || appointment.businessId !== user.business!.id) {
    return { ok: false, error: "No encontramos ese turno." };
  }

  await updateAppointmentStatus(appointmentId, status);

  revalidatePath("/panel/agenda");
  revalidatePath("/mis-turnos");
  return { ok: true };
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores en `src/actions/bookings.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/actions/bookings.ts
git commit -m "refactor: rewrite booking actions to use Firestore transaction"
```

---

## Task 12: Reescribir `src/lib/reminders.ts`

**Files:**
- Modify: `src/lib/reminders.ts` (todo el archivo)

**Interfaces:**
- Consumes: `getDueReminders`, `markReminderSent` (Task 6); `getBusinessById` (Task 4); `getServiceById` (Task 5); `getUserByUid` (Task 2).
- Produces: misma firma — `sendDueReminders(): Promise<{ checked: number; sent: number }>`.

- [ ] **Step 1: Reemplazar el contenido completo de `src/lib/reminders.ts`**

```ts
import { getDueReminders, markReminderSent } from "./db/appointments";
import { getBusinessById } from "./db/businesses";
import { getServiceById } from "./db/services";
import { getUserByUid } from "./db/users";
import { sendMail, bookingReminderEmail } from "./mailer";
import { formatDateLong, formatTime } from "./format";
import { REMINDER_HOURS_BEFORE } from "./config";

/**
 * Busca turnos que empiezan dentro de la ventana de recordatorio
 * (por defecto, entre 23 y 25 horas antes) y a los que todavía no
 * se les envió el recordatorio, y les manda el email correspondiente.
 *
 * Pensado para ejecutarse periódicamente (cada 1 hora aprox.) desde
 * /api/cron/reminders o desde scripts/send-reminders.ts.
 */
export async function sendDueReminders() {
  const now = new Date();
  const windowStart = new Date(now.getTime() + (REMINDER_HOURS_BEFORE - 1) * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + (REMINDER_HOURS_BEFORE + 1) * 60 * 60 * 1000);

  const appointments = await getDueReminders(windowStart, windowEnd);

  let sent = 0;
  for (const appt of appointments) {
    const [client, business, service] = await Promise.all([
      getUserByUid(appt.clientId),
      getBusinessById(appt.businessId),
      getServiceById(appt.serviceId),
    ]);
    // Firestore no tiene foreign keys: si alguno de los tres fue borrado, se
    // salta el recordatorio en vez de romper el resto de la corrida.
    if (!client || !business || !service) continue;

    try {
      await sendMail({
        to: client.email,
        subject: `Recordatorio de tu turno en ${business.name}`,
        html: bookingReminderEmail({
          clientName: client.name,
          businessName: business.name,
          serviceName: service.name,
          dateLabel: formatDateLong(appt.startsAt),
          timeLabel: formatTime(appt.startsAt),
          address: business.address,
        }),
      });
      await markReminderSent(appt.id);
      sent++;
    } catch (err) {
      console.error(`No se pudo enviar el recordatorio del turno ${appt.id}`, err);
    }
  }

  return { checked: appointments.length, sent };
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores en `src/lib/reminders.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/reminders.ts
git commit -m "refactor: rewrite reminders to query Firestore"
```

---

## Task 13: Páginas del marketplace

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/negocios/page.tsx`
- Modify: `src/app/negocios/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getPublishedBusinesses` (Task 4), `getServicesForBusinesses`, `getServicesByBusiness` (Task 5), `getBusinessBySlug` (Task 4), `getHoursByBusiness` (Task 3), `getProfessionalsByBusiness` (Task 5).

- [ ] **Step 1: Reemplazar el contenido completo de `src/app/page.tsx`**

```tsx
import Link from "next/link";
import { getPublishedBusinesses } from "@/lib/db/businesses";
import { CATEGORIES } from "@/lib/config";
import BusinessCard from "@/components/business-card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const businesses = await getPublishedBusinesses({ take: 8 });

  return (
    <div>
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="section py-16 sm:py-24 text-center">
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-900">
            Reservá turnos en los mejores <br className="hidden sm:block" />
            <span className="text-brand-600">negocios de belleza y bienestar</span>
          </h1>
          <p className="mt-4 text-neutral-500 max-w-xl mx-auto">
            Elegí un negocio, un profesional, el día y la hora. Confirmá tu turno en menos de un minuto.
          </p>

          <form action="/negocios" className="mt-8 max-w-xl mx-auto flex gap-2">
            <input
              type="text"
              name="q"
              placeholder="Buscá por negocio o servicio, ej: corte, manicura..."
              className="input flex-1 bg-white"
            />
            <button type="submit" className="btn-primary shrink-0">
              Buscar
            </button>
          </form>
        </div>
      </section>

      <section className="section py-10">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">Servicios más solicitados</h2>
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.filter((c) => c.slug !== "otros").map((c) => (
            <Link
              key={c.slug}
              href={`/negocios?categoria=${c.slug}`}
              className="btn-secondary"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="section py-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-neutral-900">Negocios destacados</h2>
          <Link href="/negocios" className="text-sm font-semibold text-brand-600">
            Ver todos →
          </Link>
        </div>

        {businesses.length === 0 ? (
          <p className="text-neutral-500">
            Todavía no hay negocios publicados. ¡Sé el primero!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {businesses.map((b) => (
              <BusinessCard key={b.slug} business={b} />
            ))}
          </div>
        )}
      </section>

      <section className="section py-16">
        <div className="card bg-brand-600 text-white p-10 text-center rounded-xl2">
          <h2 className="text-2xl font-bold">¿Tenés un negocio de belleza o bienestar?</h2>
          <p className="mt-2 text-brand-50 max-w-xl mx-auto">
            Publicalo gratis, cargá tus servicios y empezá a recibir reservas online las 24hs.
          </p>
          <Link href="/publica-tu-negocio" className="btn-secondary mt-6 inline-flex bg-white">
            Publicá tu negocio
          </Link>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Reemplazar el contenido completo de `src/app/negocios/page.tsx`**

```tsx
import Link from "next/link";
import { getPublishedBusinesses } from "@/lib/db/businesses";
import { getServicesForBusinesses } from "@/lib/db/services";
import { CATEGORIES } from "@/lib/config";
import BusinessCard from "@/components/business-card";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { q?: string; categoria?: string };
}

export default async function NegociosPage({ searchParams }: Props) {
  const q = searchParams.q?.trim().toLowerCase() || "";
  const categoria = searchParams.categoria || "";

  let businesses = await getPublishedBusinesses(categoria ? { category: categoria } : {});

  if (q) {
    const services = await getServicesForBusinesses(businesses.map((b) => b.id));
    const businessIdsWithMatchingService = new Set(
      services.filter((s) => s.name.toLowerCase().includes(q)).map((s) => s.businessId)
    );
    businesses = businesses.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.description?.toLowerCase().includes(q) ?? false) ||
        businessIdsWithMatchingService.has(b.id)
    );
  }

  return (
    <div className="section py-10">
      <h1 className="text-2xl font-bold text-neutral-900 mb-1">Explorá negocios</h1>
      <p className="text-neutral-500 mb-6">
        {businesses.length} negocio{businesses.length !== 1 ? "s" : ""} disponible{businesses.length !== 1 ? "s" : ""}
        {categoria ? ` en ${CATEGORIES.find((c) => c.slug === categoria)?.label ?? categoria}` : ""}
        {q ? ` para "${q}"` : ""}
      </p>

      <form action="/negocios" className="flex gap-2 mb-6 max-w-lg">
        {categoria && <input type="hidden" name="categoria" value={categoria} />}
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscá por negocio o servicio..."
          className="input flex-1"
        />
        <button type="submit" className="btn-primary shrink-0">Buscar</button>
      </form>

      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          href={q ? `/negocios?q=${encodeURIComponent(q)}` : "/negocios"}
          className={categoria ? "btn-ghost border border-neutral-200" : "btn-primary"}
        >
          Todas las categorías
        </Link>
        {CATEGORIES.map((c) => {
          const href = `/negocios?categoria=${c.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
          const active = categoria === c.slug;
          return (
            <Link
              key={c.slug}
              href={href}
              className={active ? "btn-primary" : "btn-ghost border border-neutral-200"}
            >
              {c.label}
            </Link>
          );
        })}
      </div>

      {businesses.length === 0 ? (
        <div className="card p-10 text-center text-neutral-500">
          No encontramos negocios con esos filtros. Probá con otra búsqueda.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {businesses.map((b) => (
            <BusinessCard key={b.slug} business={b} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Reemplazar el contenido completo de `src/app/negocios/[slug]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/db/businesses";
import { getServicesByBusiness, type ServiceDoc } from "@/lib/db/services";
import { getHoursByBusiness } from "@/lib/db/hours";
import { getProfessionalsByBusiness } from "@/lib/db/professionals";
import { categoryLabel, DAYS_OF_WEEK } from "@/lib/config";
import { formatDuration, formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export default async function BusinessDetailPage({ params }: Props) {
  const business = await getBusinessBySlug(params.slug);
  if (!business || !business.published) notFound();

  const [services, hours, professionals] = await Promise.all([
    getServicesByBusiness(business.id, { activeOnly: true }),
    getHoursByBusiness(business.id),
    getProfessionalsByBusiness(business.id, { activeOnly: true }),
  ]);

  const servicesByCategory = new Map<string, ServiceDoc[]>();
  for (const service of services) {
    const list = servicesByCategory.get(service.category) ?? [];
    list.push(service);
    servicesByCategory.set(service.category, list);
  }

  const whatsappHref = business.whatsapp
    ? `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(`Hola! Quiero consultar por ${business.name}`)}`
    : null;

  return (
    <div>
      <div className="h-48 sm:h-64 w-full bg-gradient-to-br from-brand-200 to-brand-400 flex items-end">
        <div className="section pb-6">
          <span className="inline-block text-xs font-semibold uppercase tracking-wide bg-white/90 text-brand-700 rounded-full px-3 py-1 mb-2">
            {categoryLabel(business.category)}
          </span>
          <h1 className="text-3xl font-extrabold text-white drop-shadow">{business.name}</h1>
        </div>
      </div>

      <div className="section py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {business.description && (
            <div className="card p-6">
              <h2 className="font-semibold text-neutral-900 mb-2">Descripción</h2>
              <p className="text-neutral-600 text-sm leading-relaxed">{business.description}</p>
            </div>
          )}

          <div id="servicios" className="space-y-6">
            <h2 className="font-semibold text-neutral-900 text-lg">Servicios</h2>
            {servicesByCategory.size === 0 && (
              <p className="text-neutral-500 text-sm">Este negocio todavía no cargó servicios.</p>
            )}
            {Array.from(servicesByCategory.entries()).map(([category, services]) => (
              <div key={category} className="card p-6">
                <h3 className="text-xs font-bold uppercase tracking-wide text-brand-600 mb-4">
                  {category}
                </h3>
                <ul className="divide-y divide-neutral-100">
                  {services.map((service) => (
                    <li key={service.id} className="py-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-neutral-900">{service.name}</p>
                        {service.description && (
                          <p className="text-sm text-neutral-500 mt-0.5">{service.description}</p>
                        )}
                        <p className="text-sm text-neutral-400 mt-1">
                          {formatDuration(service.durationMin)} · {formatPrice(service.price)}
                        </p>
                      </div>
                      <Link
                        href={`/negocios/${business.slug}/reservar?servicio=${service.id}`}
                        className="btn-primary shrink-0"
                      >
                        Reservar
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="font-semibold text-neutral-900 mb-4">Información</h2>
            <ul className="space-y-3 text-sm text-neutral-600">
              {business.address && (
                <li className="flex gap-2">
                  <span aria-hidden>📍</span>
                  <span>{business.address}</span>
                </li>
              )}
              {business.phone && (
                <li className="flex gap-2">
                  <span aria-hidden>📞</span>
                  <a href={`tel:${business.phone}`} className="hover:text-brand-600">{business.phone}</a>
                </li>
              )}
              {whatsappHref && (
                <li className="flex gap-2">
                  <span aria-hidden>💬</span>
                  <a href={whatsappHref} target="_blank" rel="noreferrer" className="hover:text-brand-600">
                    Enviar WhatsApp
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div className="card p-6">
            <h2 className="font-semibold text-neutral-900 mb-4">Horarios de atención</h2>
            <ul className="text-sm text-neutral-600 space-y-1.5">
              {hours.map((h) => (
                <li key={h.dayOfWeek} className="flex justify-between">
                  <span>{DAYS_OF_WEEK[h.dayOfWeek]}</span>
                  <span className={h.isClosed ? "text-neutral-400" : ""}>
                    {h.isClosed ? "Cerrado" : `${h.openTime} – ${h.closeTime}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {professionals.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-neutral-900 mb-4">Profesionales</h2>
              <ul className="text-sm text-neutral-600 space-y-1.5">
                {professionals.map((p) => (
                  <li key={p.id}>{p.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores en estas tres páginas.

- [ ] **Step 5: Verificación manual**

Con datos de seed cargados (después de Task 17), correr `npm run dev` y abrir `http://localhost:3000`, `http://localhost:3000/negocios`, `http://localhost:3000/negocios?q=corte`, `http://localhost:3000/negocios/nueva-imagen-peluqueria`. Confirmar que los negocios y servicios se ven, y que la búsqueda por texto filtra correctamente.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/negocios/page.tsx "src/app/negocios/[slug]/page.tsx"
git commit -m "refactor: rewrite marketplace pages to read from Firestore"
```

---

## Task 14: Página de reserva y "Mis turnos"

**Files:**
- Modify: `src/app/negocios/[slug]/reservar/page.tsx`
- Modify: `src/app/mis-turnos/page.tsx`

**Interfaces:**
- Consumes: `getBusinessBySlug` (Task 4), `getServicesByBusiness`, `getProfessionalsByBusiness` (Task 5), `getCurrentUser`, `requireClientUser` (Task 7), `getAppointmentsForClient`, `hydrateForClient` (Task 6).

- [ ] **Step 1: Reemplazar el contenido completo de `src/app/negocios/[slug]/reservar/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getBusinessBySlug } from "@/lib/db/businesses";
import { getServicesByBusiness } from "@/lib/db/services";
import { getProfessionalsByBusiness } from "@/lib/db/professionals";
import { getCurrentUser } from "@/lib/session";
import BookingWizard from "@/components/booking-wizard";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
  searchParams: { servicio?: string; profesional?: string; fecha?: string; hora?: string };
}

export default async function ReservarPage({ params, searchParams }: Props) {
  const business = await getBusinessBySlug(params.slug);
  if (!business || !business.published) notFound();

  const [services, professionals, user] = await Promise.all([
    getServicesByBusiness(business.id, { activeOnly: true }),
    getProfessionalsByBusiness(business.id, { activeOnly: true }),
    getCurrentUser(),
  ]);

  if (services.length === 0) {
    return (
      <div className="section py-16 text-center text-neutral-500">
        Este negocio todavía no cargó servicios para reservar.
      </div>
    );
  }

  return (
    <div className="section py-10">
      <h1 className="text-2xl font-bold text-neutral-900 mb-1 text-center">Reservar en {business.name}</h1>
      <p className="text-neutral-500 text-center mb-8">{business.address}</p>

      <BookingWizard
        business={{ id: business.id, slug: business.slug, name: business.name, address: business.address }}
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          price: s.price,
          durationMin: s.durationMin,
          description: s.description,
        }))}
        professionals={professionals.map((p) => ({ id: p.id, name: p.name }))}
        initial={searchParams}
        user={user ? { id: user.id, role: user.role } : null}
      />
    </div>
  );
}
```

- [ ] **Step 2: Reemplazar el contenido completo de `src/app/mis-turnos/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireClientUser } from "@/lib/session";
import { getAppointmentsForClient, hydrateForClient } from "@/lib/db/appointments";
import { formatDateLong, formatPrice, formatTime } from "@/lib/format";
import CancelAppointmentButton from "@/components/cancel-appointment-button";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  CANCELADO: "Cancelado",
  COMPLETADO: "Completado",
};

const STATUS_STYLE: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-700",
  CONFIRMADO: "bg-green-100 text-green-700",
  CANCELADO: "bg-red-100 text-red-700",
  COMPLETADO: "bg-neutral-100 text-neutral-600",
};

export default async function MisTurnosPage() {
  const user = await requireClientUser();
  if (!user) redirect("/login?callbackUrl=/mis-turnos");

  const rawAppointments = await getAppointmentsForClient(user.id);
  const appointments = await hydrateForClient(rawAppointments);

  const now = new Date();
  const upcoming = appointments
    .filter((a) => a.startsAt >= now && a.status !== "CANCELADO")
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const rest = appointments.filter((a) => !upcoming.includes(a));

  function AppointmentCard({ a, showCancel }: { a: (typeof appointments)[number]; showCancel: boolean }) {
    return (
      <div className="card p-5 flex items-start justify-between gap-4">
        <div>
          <span className={`inline-block text-xs font-semibold rounded-full px-2.5 py-0.5 mb-2 ${STATUS_STYLE[a.status]}`}>
            {STATUS_LABEL[a.status]}
          </span>
          <p className="font-semibold text-neutral-900">
            <Link href={`/negocios/${a.business.slug}`} className="hover:text-brand-600">
              {a.business.name}
            </Link>
          </p>
          <p className="text-sm text-neutral-600">{a.service.name} · con {a.professional.name}</p>
          <p className="text-sm text-neutral-500 mt-1 capitalize">
            {formatDateLong(a.startsAt)} a las {formatTime(a.startsAt)}
          </p>
          <p className="text-sm font-medium text-brand-600 mt-1">{formatPrice(a.service.price)}</p>
        </div>
        {showCancel && (a.status === "CONFIRMADO" || a.status === "PENDIENTE") && (
          <CancelAppointmentButton appointmentId={a.id} />
        )}
      </div>
    );
  }

  return (
    <div className="section py-10 max-w-3xl">
      <h1 className="text-2xl font-bold text-neutral-900 mb-6">Mis turnos</h1>

      <section className="mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-3">
          Próximos turnos
        </h2>
        {upcoming.length === 0 ? (
          <div className="card p-6 text-neutral-500 text-sm">
            No tenés turnos próximos. <Link href="/negocios" className="text-brand-600 font-medium">Reservá uno</Link>.
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((a) => (
              <AppointmentCard key={a.id} a={a} showCancel />
            ))}
          </div>
        )}
      </section>

      {rest.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-3">Historial</h2>
          <div className="space-y-3">
            {rest.map((a) => (
              <AppointmentCard key={a.id} a={a} showCancel={false} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores en estas dos páginas.

- [ ] **Step 4: Commit**

```bash
git add "src/app/negocios/[slug]/reservar/page.tsx" src/app/mis-turnos/page.tsx
git commit -m "refactor: rewrite booking wizard and mis-turnos pages to use Firestore"
```

---

## Task 15: Panel — dashboard y agenda

**Files:**
- Modify: `src/app/panel/page.tsx`
- Modify: `src/app/panel/agenda/page.tsx`

**Interfaces:**
- Consumes: `requireBusinessUser` (Task 7), `getAppointmentsInRange`, `hydrateForBusiness` (Task 6), `getServicesByBusiness` (Task 5), `getProfessionalsByBusiness` (Task 5).

- [ ] **Step 1: Reemplazar el contenido completo de `src/app/panel/page.tsx`**

```tsx
import Link from "next/link";
import { requireBusinessUser } from "@/lib/session";
import { getAppointmentsInRange, hydrateForBusiness } from "@/lib/db/appointments";
import { getServicesByBusiness } from "@/lib/db/services";
import { getProfessionalsByBusiness } from "@/lib/db/professionals";
import { formatPrice, formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PanelDashboardPage() {
  const user = await requireBusinessUser();
  const businessId = user!.business!.id;

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [rawTodayAppointments, weekAppointments, services, professionals] = await Promise.all([
    getAppointmentsInRange(businessId, todayStart, todayEnd),
    getAppointmentsInRange(businessId, now, weekEnd),
    getServicesByBusiness(businessId, { activeOnly: true }),
    getProfessionalsByBusiness(businessId, { activeOnly: true }),
  ]);

  const todayAppointments = (await hydrateForBusiness(rawTodayAppointments)).filter(
    (a) => a.status === "CONFIRMADO" || a.status === "PENDIENTE"
  );
  const weekCount = weekAppointments.filter(
    (a) => a.status === "CONFIRMADO" || a.status === "PENDIENTE"
  ).length;

  const stats = [
    { label: "Turnos hoy", value: todayAppointments.length },
    { label: "Turnos próximos 7 días", value: weekCount },
    { label: "Servicios activos", value: services.length },
    { label: "Profesionales activos", value: professionals.length },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <p className="text-2xl font-bold text-neutral-900">{s.value}</p>
            <p className="text-sm text-neutral-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-neutral-900">Turnos de hoy</h2>
          <Link href="/panel/agenda" className="text-sm font-semibold text-brand-600">
            Ver agenda completa →
          </Link>
        </div>
        {todayAppointments.length === 0 ? (
          <p className="text-sm text-neutral-500">No tenés turnos agendados para hoy.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {todayAppointments.map((a) => (
              <li key={a.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-neutral-900">
                    {formatTime(a.startsAt)} · {a.service.name}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {a.client.name} {a.client.lastName ?? ""} · con {a.professional.name}
                  </p>
                </div>
                <span className="text-sm font-semibold text-brand-600">{formatPrice(a.service.price)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {services.length === 0 && (
        <div className="card p-6 bg-amber-50 border-amber-100">
          <p className="text-sm text-amber-800">
            Todavía no cargaste servicios, así que tu negocio no puede recibir reservas.{" "}
            <Link href="/panel/servicios" className="font-semibold underline">
              Cargá tu primer servicio
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Reemplazar el contenido completo de `src/app/panel/agenda/page.tsx`**

```tsx
import Link from "next/link";
import { requireBusinessUser } from "@/lib/session";
import { getAppointmentsInRange, hydrateForBusiness } from "@/lib/db/appointments";
import { formatDateLong, formatPrice, formatTime } from "@/lib/format";
import AppointmentStatusActions from "@/components/appointment-status-actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  CANCELADO: "Cancelado",
  COMPLETADO: "Completado",
};

const STATUS_STYLE: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-700",
  CONFIRMADO: "bg-green-100 text-green-700",
  CANCELADO: "bg-red-100 text-red-700",
  COMPLETADO: "bg-neutral-100 text-neutral-600",
};

function isoOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Props {
  searchParams: { fecha?: string };
}

export default async function AgendaPage({ searchParams }: Props) {
  const user = await requireBusinessUser();
  const businessId = user!.business!.id;

  const selected = searchParams.fecha ? new Date(`${searchParams.fecha}T00:00:00`) : new Date();
  selected.setHours(0, 0, 0, 0);

  const dayEnd = new Date(selected);
  dayEnd.setHours(23, 59, 59, 999);

  const prevDay = new Date(selected);
  prevDay.setDate(prevDay.getDate() - 1);
  const nextDay = new Date(selected);
  nextDay.setDate(nextDay.getDate() + 1);

  const rawAppointments = await getAppointmentsInRange(businessId, selected, dayEnd);
  const appointments = await hydrateForBusiness(rawAppointments);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Link href={`/panel/agenda?fecha=${isoOf(prevDay)}`} className="btn-ghost border border-neutral-200">
            ← Anterior
          </Link>
          <form action="/panel/agenda" className="flex items-center gap-2">
            <input type="date" name="fecha" defaultValue={isoOf(selected)} className="input" />
            <button type="submit" className="btn-secondary">Ir</button>
          </form>
          <Link href={`/panel/agenda?fecha=${isoOf(nextDay)}`} className="btn-ghost border border-neutral-200">
            Siguiente →
          </Link>
        </div>
        <Link href={`/panel/agenda?fecha=${isoOf(new Date())}`} className="text-sm font-semibold text-brand-600">
          Hoy
        </Link>
      </div>

      <h2 className="font-semibold text-neutral-900 capitalize mb-4">{formatDateLong(selected)}</h2>

      {appointments.length === 0 ? (
        <div className="card p-6 text-sm text-neutral-500">No hay turnos para este día.</div>
      ) : (
        <div className="card divide-y divide-neutral-100">
          {appointments.map((a) => (
            <div key={a.id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="text-center w-14 shrink-0">
                  <p className="font-bold text-neutral-900">{formatTime(a.startsAt)}</p>
                </div>
                <div>
                  <span className={`inline-block text-[11px] font-semibold rounded-full px-2 py-0.5 mb-1 ${STATUS_STYLE[a.status]}`}>
                    {STATUS_LABEL[a.status]}
                  </span>
                  <p className="font-medium text-neutral-900">
                    {a.service.name} · {a.client.name} {a.client.lastName ?? ""}
                  </p>
                  <p className="text-sm text-neutral-500">
                    con {a.professional.name} · {formatPrice(a.service.price)}
                    {a.client.phone ? ` · ${a.client.phone}` : ""}
                  </p>
                  {a.notes && <p className="text-xs text-neutral-400 mt-0.5">Nota: {a.notes}</p>}
                </div>
              </div>
              <AppointmentStatusActions appointmentId={a.id} status={a.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores en estas dos páginas.

- [ ] **Step 4: Commit**

```bash
git add src/app/panel/page.tsx src/app/panel/agenda/page.tsx
git commit -m "refactor: rewrite panel dashboard and agenda pages to use Firestore"
```

---

## Task 16: Panel — páginas simples (negocio, horarios, profesionales, servicios)

**Files:**
- Modify: `src/app/panel/negocio/page.tsx`
- Modify: `src/app/panel/horarios/page.tsx`
- Modify: `src/app/panel/profesionales/page.tsx`
- Modify: `src/app/panel/servicios/page.tsx`

**Interfaces:**
- Consumes: `requireBusinessUser` (Task 7), `getHoursByBusiness` (Task 3), `getProfessionalsByBusiness`, `getServicesByBusiness` (Task 5).

**Nota de diseño:** `panel/negocio/page.tsx` original volvía a leer el negocio de la base aunque `requireBusinessUser()` ya lo devuelve — era una lectura redundante incluso en el código Prisma original. Se simplifica reusando `user.business`.

- [ ] **Step 1: Reemplazar el contenido completo de `src/app/panel/negocio/page.tsx`**

```tsx
import { requireBusinessUser } from "@/lib/session";
import BusinessProfileForm from "@/components/business-profile-form";

export const dynamic = "force-dynamic";

export default async function NegocioPage() {
  const user = await requireBusinessUser();
  return <BusinessProfileForm business={user!.business!} />;
}
```

- [ ] **Step 2: Reemplazar el contenido completo de `src/app/panel/horarios/page.tsx`**

```tsx
import { requireBusinessUser } from "@/lib/session";
import { getHoursByBusiness } from "@/lib/db/hours";
import HoursManager from "@/components/hours-manager";

export const dynamic = "force-dynamic";

export default async function HorariosPage() {
  const user = await requireBusinessUser();
  const hours = await getHoursByBusiness(user!.business!.id);
  return <HoursManager hours={hours} />;
}
```

- [ ] **Step 3: Reemplazar el contenido completo de `src/app/panel/profesionales/page.tsx`**

```tsx
import { requireBusinessUser } from "@/lib/session";
import { getProfessionalsByBusiness } from "@/lib/db/professionals";
import ProfessionalsManager from "@/components/professionals-manager";

export const dynamic = "force-dynamic";

export default async function ProfesionalesPage() {
  const user = await requireBusinessUser();
  const professionals = await getProfessionalsByBusiness(user!.business!.id);
  return <ProfessionalsManager professionals={professionals} />;
}
```

- [ ] **Step 4: Reemplazar el contenido completo de `src/app/panel/servicios/page.tsx`**

```tsx
import { requireBusinessUser } from "@/lib/session";
import { getServicesByBusiness } from "@/lib/db/services";
import ServicesManager from "@/components/services-manager";

export const dynamic = "force-dynamic";

export default async function ServiciosPage() {
  const user = await requireBusinessUser();
  const services = await getServicesByBusiness(user!.business!.id);
  return <ServicesManager services={services} />;
}
```

- [ ] **Step 5: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: cero errores en todo el proyecto (esta es la última página que tocaba `prisma`).

- [ ] **Step 6: Commit**

```bash
git add src/app/panel/negocio/page.tsx src/app/panel/horarios/page.tsx src/app/panel/profesionales/page.tsx src/app/panel/servicios/page.tsx
git commit -m "refactor: rewrite remaining panel pages to use Firestore"
```

---

## Task 17: Reescribir el script de siembra (`scripts/seed-firestore.ts`)

**Files:**
- Create: `scripts/seed-firestore.ts`
- Delete (mover a backup, no borrar sin respaldo): `prisma/seed.ts`

**Interfaces:**
- Consumes: `getAdminAuth` (`src/lib/firebase-admin.ts`), `getBusinessBySlug`, `createBusinessOwnerBatch` (Task 4), `createService`, `getServicesByBusiness` (Task 5), `createProfessional`, `getProfessionalsByBusiness` (Task 5), `createUser`, `getUserByUid` (Task 2), `createAppointmentDoc` (Task 6, escritura directa sin re-chequeo de disponibilidad — a propósito, para poder crear el turno "pasado" de la demo).

- [ ] **Step 1: Crear `scripts/seed-firestore.ts`**

```ts
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

const STANDARD_HOURS = [
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
  services: { category: string; name: string; description?: string; price: number; durationMin: number }[];
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
      { category: "Corte", name: "Corte Mujer", description: "Incluye lavado y secado.", price: 18000, durationMin: 45 },
      { category: "Corte", name: "Corte Hombre", price: 12000, durationMin: 30 },
      { category: "Color", name: "Coloración raíz", description: "Retoque de raíz hasta 3cm.", price: 25000, durationMin: 60 },
      { category: "Color", name: "Balayage", description: "Técnica de iluminación con degradado natural.", price: 60000, durationMin: 120 },
      { category: "Peinados", name: "Brushing", price: 15000, durationMin: 30 },
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
      { category: "Corte", name: "Corte clásico", price: 10000, durationMin: 30 },
      { category: "Corte", name: "Corte + Barba", price: 15000, durationMin: 45 },
      { category: "Barba", name: "Arreglo de barba", price: 7000, durationMin: 20 },
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
      { category: "Masajes", name: "Masaje relajante", price: 30000, durationMin: 60 },
      { category: "Masajes", name: "Masaje descontracturante", price: 26000, durationMin: 45 },
      { category: "Uñas", name: "Manicura", price: 12000, durationMin: 40 },
      { category: "Uñas", name: "Pedicura", price: 15000, durationMin: 50 },
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
```

- [ ] **Step 2: Mover `prisma/seed.ts` a un backup (no lo borres directo — no hay git history para recuperarlo)**

```bash
mkdir -p /tmp/turnia-prisma-backup
mv prisma/seed.ts /tmp/turnia-prisma-backup/seed.ts
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores en `scripts/seed-firestore.ts`.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-firestore.ts
git rm prisma/seed.ts
git commit -m "refactor: rewrite seed script to write to Firestore"
```

(El `npm run db:seed` real contra Firestore se corre en la Task 19, después de que `package.json` apunte a este script en la Task 18.)

---

## Task 18: Sacar Prisma del proyecto y limpiar el prototipo viejo

**Files:**
- Modify: `package.json`
- Modify: `.env`
- Modify: `.env.example`
- Delete (mover a backup): `prisma/schema.prisma`, `public/index.html`, `public/login.html`, `public/panel.html`, `public/css/`, `public/js/`, `firebase.json`, `.firebaserc`, `firestore.rules`
- Create: `firestore.indexes.json`
- Create: `firebase.json` (versión nueva, sólo para índices)
- Create: `.firebaserc` (versión nueva)

- [ ] **Step 1: Editar `package.json`**

Quitar `@prisma/client` de `dependencies` y `prisma` de `devDependencies`. Quitar el bloque `"prisma": { "seed": ... }`. Cambiar los `scripts`:

```json
{
  "name": "turnia",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:seed": "tsx scripts/seed-firestore.ts",
    "reminders:send": "tsx scripts/send-reminders.ts"
  },
  "dependencies": {
    "date-fns": "^3.6.0",
    "firebase": "^11.0.0",
    "firebase-admin": "^13.0.0",
    "next": "^14.2.35",
    "nodemailer": "^7.0.7",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.14.15",
    "@types/nodemailer": "^6.4.16",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.20",
    "dotenv": "^16.4.5",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10",
    "tsx": "^4.19.1",
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 2: Editar `.env`** — quitar las líneas de `DATABASE_URL`/`DIRECT_URL` y su comentario (todo lo demás queda igual)

```
# Nombre de la plataforma (se muestra en toda la app)
NEXT_PUBLIC_APP_NAME="TURNIA"
```

(reemplaza el bloque de comentario + `DATABASE_URL` + `DIRECT_URL` que hoy está al principio del archivo).

- [ ] **Step 3: Editar `.env.example`** — quitar el mismo bloque

```
# Nombre de la plataforma (se muestra en toda la app)
NEXT_PUBLIC_APP_NAME="Turnia"
```

(reemplaza el bloque de comentario + `DATABASE_URL` al principio del archivo).

- [ ] **Step 4: Mover a backup los archivos que ya no se usan**

```bash
mkdir -p /tmp/turnia-prisma-backup /tmp/turnia-old-prototype-backup
mv prisma/schema.prisma /tmp/turnia-prisma-backup/schema.prisma
rmdir prisma
mv public/index.html public/login.html public/panel.html /tmp/turnia-old-prototype-backup/
mv public/css /tmp/turnia-old-prototype-backup/css
mv public/js /tmp/turnia-old-prototype-backup/js
mv firebase.json /tmp/turnia-old-prototype-backup/firebase.json
mv .firebaserc /tmp/turnia-old-prototype-backup/.firebaserc
mv firestore.rules /tmp/turnia-old-prototype-backup/firestore.rules
```

- [ ] **Step 5: Crear `firestore.indexes.json`**

```json
{
  "indexes": [
    {
      "collectionGroup": "turnia_appointments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "businessId", "order": "ASCENDING" },
        { "fieldPath": "startsAt", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 6: Crear `firebase.json` nuevo (sólo índices — sin hosting/firestore rules del prototipo viejo)**

```json
{
  "firestore": {
    "indexes": "firestore.indexes.json"
  }
}
```

- [ ] **Step 7: Crear `.firebaserc` nuevo**

```json
{
  "projects": {
    "default": "coyote-house"
  }
}
```

- [ ] **Step 8: Sincronizar dependencias**

```bash
npm uninstall prisma @prisma/client
```

Expected: `package.json` y `package-lock.json` quedan sin esas dos dependencias, `node_modules/@prisma` y `node_modules/.prisma` se eliminan.

- [ ] **Step 9: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: cero errores en todo el proyecto.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json .env.example firestore.indexes.json firebase.json .firebaserc
git rm -r prisma public/index.html public/login.html public/panel.html public/css public/js firestore.rules
git commit -m "chore: remove Prisma and old static prototype, add Firestore indexes config"
```

(`.env` no se commitea — está en `.gitignore`.)

---

## Task 19: Despliegue de índices y verificación final

**Files:** ninguno nuevo — sólo comandos y verificación manual.

- [ ] **Step 1: Desplegar el índice compuesto**

```bash
firebase deploy --only firestore:indexes
```

Expected: `✔ Deploy complete!` (a diferencia del `firestore:rules,hosting` de antes, este comando sí corresponde a la app actual).

Si `firebase` CLI pide login, correr `firebase login` primero (requiere interacción del usuario en el navegador — pedírselo al usuario si hace falta).

- [ ] **Step 2: Compilación completa**

```bash
npx tsc --noEmit
```

Expected: cero errores.

```bash
npm run build
```

Expected: `✓ Compiled successfully` y las 17 rutas listadas, igual que en la verificación previa a esta migración.

- [ ] **Step 3: Sembrar datos de ejemplo**

```bash
npm run db:seed
```

Expected: imprime "Listo. Usuarios de prueba..." sin errores. Correrlo una segunda vez debe imprimir el mismo mensaje sin duplicar negocios (`ensureBusiness` los encuentra por slug y no vuelve a crearlos).

- [ ] **Step 4: Verificación manual end-to-end**

Con `npm run dev` corriendo:

1. Ir a `/` y `/negocios` — deben verse los 3 negocios del seed.
2. Ir a `/negocios/nueva-imagen-peluqueria` — deben verse sus servicios agrupados por categoría, horarios y profesionales.
3. Login como `juan@cliente.com` / `demo1234` en `/login` — ir a `/mis-turnos` y confirmar que se ven los turnos sembrados (2 próximos, 1 en historial).
4. Reservar un turno nuevo desde `/negocios/barberia-el-zorro/reservar` — confirmar que aparece en `/mis-turnos` y que llegó el email (o se imprimió en la consola del servidor si no hay SMTP configurado).
5. Login como `diego@elzorro.com` / `demo1234` — ir a `/panel/agenda` y confirmar que el turno reservado en el paso anterior aparece ahí.
6. Cambiar el estado del turno desde `/panel/agenda` (confirmar/cancelar/completar) y verificar que se refleja en `/mis-turnos` del cliente.
7. Cancelar un turno desde `/mis-turnos` como cliente y verificar que se refleja en `/panel/agenda`.
8. Registrar un negocio nuevo desde `/registro-negocio` — confirmar que crea el usuario, el negocio (con horario default lunes a sábado 10-20) y redirige a `/panel`.
9. Correr `npm run reminders:send` manualmente y confirmar que no tira error (puede no encontrar turnos dentro de la ventana de 23-25hs, eso es esperable).

- [ ] **Step 5: Commit final (si algo quedó sin commitear)**

```bash
git status
```

Si hay cambios pendientes de los pasos anteriores, revisarlos y commitearlos.

---

## Resumen de archivos tocados

| Categoría | Archivos |
|---|---|
| Nuevos (`src/lib/db/`) | `collections.ts`, `users.ts`, `hours.ts`, `businesses.ts`, `services.ts`, `professionals.ts`, `appointments.ts` |
| Modificados (`src/lib/`) | `firebase-admin.ts`, `session.ts`, `reminders.ts` |
| Modificados (`src/actions/`) | `auth.ts`, `business.ts`, `hours.ts`, `professionals.ts`, `services.ts`, `bookings.ts` |
| Modificados (`src/app/`) | `page.tsx`, `negocios/page.tsx`, `negocios/[slug]/page.tsx`, `negocios/[slug]/reservar/page.tsx`, `mis-turnos/page.tsx`, `panel/page.tsx`, `panel/agenda/page.tsx`, `panel/negocio/page.tsx`, `panel/horarios/page.tsx`, `panel/profesionales/page.tsx`, `panel/servicios/page.tsx` |
| Nuevo (`scripts/`) | `seed-firestore.ts` |
| Borrados | `prisma/` completo, `public/{index,login,panel}.html`, `public/css/`, `public/js/`, `firebase.json` viejo, `.firebaserc` viejo, `firestore.rules` viejo |
| Config nueva | `firestore.indexes.json`, `firebase.json` nuevo, `.firebaserc` nuevo |
| Sin cambios | `src/lib/slots.ts`, `src/lib/mailer.ts`, `src/lib/format.ts`, `src/lib/config.ts`, `src/lib/firebase-client.ts`, `src/lib/firebase-errors.ts`, `src/middleware.ts`, todos los `src/components/*.tsx`, `src/actions/session.ts` |

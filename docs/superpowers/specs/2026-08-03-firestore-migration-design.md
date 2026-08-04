
# Migración de Prisma/Postgres a Firestore (todo Firebase)

## Contexto

Turnia usaba Prisma ORM sobre Postgres (Supabase) para todos los datos de negocio
(usuarios, negocios, servicios, profesionales, horarios, turnos), y Firebase
Authentication sólo para identidad. Al poner en marcha el proyecto se encontró
fricción real con esa combinación (setup de Supabase, Prisma 7 rompiendo el
`datasource.url` clásico, drift de esquema). El dueño del proyecto decidió
simplificar a un solo proveedor: sacar Prisma/Postgres y usar Firebase
(Authentication + Firestore) para todo.

No hay datos reales que migrar: nunca se aplicó una migración exitosa contra la
base Postgres, así que es un reemplazo limpio del motor de datos, no una
migración de datos.

**Detalle importante del entorno**: el proyecto de Firebase (`coyote-house`) es
**compartido** con otra app no relacionada, que ya tiene su propia colección
`users` en Firestore. Para evitar cualquier colisión, todas las colecciones de
Turnia van prefijadas con `turnia_`.

## Alcance

**Adentro:**
- Reemplazar todo uso de `prisma`/`@prisma/client` por Firestore vía Admin SDK.
- Reescribir `prisma/seed.ts` como script de siembra sobre Firestore.
- Sacar `prisma`, `@prisma/client`, `prisma/schema.prisma`, `DATABASE_URL`,
  `DIRECT_URL` del proyecto.
- Borrar el prototipo estático viejo en `public/` (HTML/JS/Firestore-cliente)
  y los archivos `firebase.json` / `.firebaserc` / `firestore.rules` que le
  correspondían — son de una implementación anterior y no tienen relación con
  la app Next.js actual.
- Declarar los índices compuestos de Firestore que la app necesita.

**Afuera de este alcance** (sin cambios):
- Firebase Authentication y el flujo de sesión (`src/lib/session.ts`,
  `src/actions/session.ts`, cookie httpOnly) — no tocan Prisma, quedan igual.
- `src/lib/slots.ts` (cálculo de horarios disponibles) — es lógica pura sobre
  estructuras en memoria, no sabe de dónde vienen los datos, no cambia.
- `src/middleware.ts`, `src/lib/mailer.ts`, componentes de UI, páginas que no
  tocan `prisma` (no aparecen en el grep de `prisma\.` sobre `src/`).

## Arquitectura

Todo el acceso a datos sigue pasando **exclusivamente por el servidor**
(Server Actions y Server Components de Next.js), igual que hoy con Prisma. El
navegador nunca habla con Firestore directamente para datos de negocio (sólo
usa el SDK de cliente de Firebase para Authentication, como ya hace). Por eso:

- El acceso es siempre vía **Firestore Admin SDK** (`firebase-admin/firestore`),
  que ignora las Security Rules de Firestore.
- **No hace falta escribir Security Rules de datos** para las colecciones
  `turnia_*` — la autorización sigue viviendo en código, en las mismas
  funciones que ya la hacen hoy (`requireBusinessUser()`, chequeos de
  `business.ownerId`, etc.). Esto es exactamente el mismo modelo de seguridad
  que ya tiene la app con Postgres (el navegador nunca habla con Postgres
  directo tampoco).
- `src/lib/firebase-admin.ts` se extiende con `getAdminDb()` (Firestore),
  junto al ya existente `getAdminAuth()`.

## Modelo de datos

Colecciones top-level, prefijo `turnia_`, cada una con forma de documento
equivalente a la tabla Prisma que reemplaza:

- **`turnia_users/{firebaseUid}`** — `id` (== doc id == firebaseUid), `name`,
  `lastName?`, `email`, `phone?`, `role` (`CLIENTE`|`NEGOCIO`|`ADMIN`),
  `createdAt`. El doc ID es el UID de Firebase directamente (reemplaza el
  `findUnique({ where: { firebaseUid } })` de hoy por un `.doc(uid).get()`).
- **`turnia_businesses/{id}`** (auto-ID) — `slug`, `name`, `category`,
  `description?`, `address?`, `phone?`, `whatsapp?`, `coverImage?`,
  `published`, `ownerId` (firebaseUid del dueño), `createdAt`. Búsqueda por
  slug: `where("slug","==",slug)` (single-field, indexado automático).
- **`turnia_services/{id}`**, **`turnia_professionals/{id}`** (auto-ID) —
  mismos campos que las tablas Prisma (`businessId`, `category`, `name`,
  `description?`, `price`, `durationMin`, `active` / `businessId`, `name`,
  `photo?`, `active`).
- **`turnia_businessHours/{businessId}__{dayOfWeek}`** — doc ID determinístico
  (no auto-ID) para reproducir la constraint única `@@unique([businessId,
  dayOfWeek])` de Prisma como upsert natural (`set()` sobre ese ID siempre
  pisa el mismo doc). Campos: `businessId`, `dayOfWeek`, `isClosed`,
  `openTime?`, `closeTime?`.
- **`turnia_appointments/{id}`** (auto-ID) — `businessId`, `professionalId`,
  `serviceId`, `clientId`, `startsAt` (Timestamp), `endsAt` (Timestamp),
  `status`, `notes?`, `reminderSent`, `createdAt`.

Todas las fechas se guardan como Firestore `Timestamp` (el Admin SDK acepta
`Date` de JS al escribir) y se convierten con `.toDate()` al leer.

## Capa de acceso a datos

Se agrega `src/lib/db/` con un archivo por colección, exponiendo sólo las
funciones puntuales que los call sites actuales necesitan (no un ORM
genérico) — mismo espíritu que hoy, sólo que hablando Firestore en vez de
Prisma:

- `src/lib/db/users.ts` — `getUserByUid`, `createUser`.
- `src/lib/db/businesses.ts` — `getBusinessById`, `getBusinessBySlug`,
  `getPublishedBusinesses({ category?, take? })`, `createBusiness`,
  `updateBusiness`, `isSlugTaken`.
- `src/lib/db/services.ts`, `db/professionals.ts` — get por negocio (con
  filtro `active`), create, update.
- `src/lib/db/hours.ts` — `getHoursByBusiness`, `upsertHours` (batch write de
  los 7 días).
- `src/lib/db/appointments.ts` — `getAppointmentsForBusinessOnDay`,
  `getAppointmentsForClient`, `getDueReminders`, `createAppointmentTx`
  (transacción), `updateAppointmentStatus`.

Estas funciones son las que reemplazan cada `prisma.<modelo>.<método>(...)` en
los 19 archivos identificados (7 en `src/actions`, 9 páginas, `session.ts`,
`reminders.ts`, `prisma/seed.ts`). Los call sites (actions, páginas) cambian
sus imports y llamadas, pero su lógica de autorización y validación (Zod,
`requireBusinessUser`, etc.) no cambia.

**Hidratación de relaciones** (reemplazo de los `include` de Prisma): como
Firestore no tiene joins, el patrón es leer el/los documento(s) principal(es),
juntar los IDs referenciados (businessId, serviceId, professionalId,
clientId) y traerlos con `db.getAll(...refs)` (una sola ida y vuelta,
múltiples docs por referencia). Se usa en: ficha de negocio (servicios +
horarios + profesionales), agenda del panel (turno + servicio + profesional +
cliente), mis-turnos (turno + negocio + servicio + profesional).

## Casos con lógica particular

**Búsqueda del marketplace** (`/negocios?q=...`): Firestore no tiene
`ILIKE`/texto libre. Se trae la lista de negocios publicados (filtrada por
categoría si aplica, con `where("published","==",true)` +
`where("category","==",categoria)` — dos igualdades, no necesita índice
compuesto), más los servicios de esos negocios (`where("businessId","in",
[...ids])`, hasta 30 ids por query), y se filtra por texto en memoria del
lado del servidor (nombre/descripción del negocio o nombre de algún
servicio). A la escala de esta app (negocios de conocidos, no cientos) esto
es preciso y no necesita infraestructura de búsqueda externa.

**Evitar doble reserva** (`createAppointment`): se usa una
`db.runTransaction()` de Firestore — dentro de la transacción se vuelve a
consultar los turnos que pisan el horario del profesional elegido ese día y
sólo se escribe el nuevo turno si el slot sigue libre; si no, se corta con el
mismo error que hoy ("Ese horario ya no está disponible"). Esto es más
estricto que el código Prisma actual (que hace `findMany` y después `create`
sin transacción, con una ventana de carrera teórica) — no es scope creep, es
lo que hace falta para tener la misma garantía sin las constraints de
Postgres.

**Recordatorios** (`sendDueReminders`, corre cada 1h vía cron): se consulta
`turnia_appointments` con **un solo filtro de rango** sobre `startsAt` (sin
combinarlo con otra igualdad, para no necesitar índice compuesto) y se
filtra `status` y `reminderSent` en memoria — el volumen en una ventana de 2
horas es chico a esta escala.

**Agenda del día / cálculo de slots**: se consulta
`turnia_appointments` con `where("businessId","==",id)` +
`where("startsAt",">=",inicio)` + `where("startsAt","<=",fin)` (esto sí
necesita índice compuesto, ver abajo) y se filtra `professionalId`/`status`
en memoria, igual que ya hace hoy el código (`busy = appointments.filter(a
=> a.professionalId === prof.id)`).

## Índices compuestos necesarios

Se declara un `firestore.indexes.json` en la raíz del proyecto y se despliega
con `firebase deploy --only firestore:indexes` (comando real y necesario acá,
a diferencia del `firestore:rules,hosting` que se iba a correr antes por
error para el prototipo viejo):

- `turnia_appointments`: `businessId` ASC + `startsAt` ASC.

El resto de las consultas usadas (igualdades múltiples, o rango sobre un solo
campo) no necesitan índice compuesto en Firestore.

## Qué se borra

- `prisma/`, `@prisma/client`, `prisma` (paquete), scripts `db:migrate`,
  `db:deploy`, `db:studio`, hook `postinstall: prisma generate`.
- `DATABASE_URL`, `DIRECT_URL` de `.env` / `.env.example`.
- `public/index.html`, `public/login.html`, `public/panel.html`,
  `public/css/`, `public/js/` (prototipo estático viejo).
- `firebase.json`, `.firebaserc`, `firestore.rules` actuales (le
  correspondían al prototipo viejo; si en algún momento se necesitan
  Security Rules reales para Turnia, se crean de cero con el prefijo
  `turnia_`).

## Qué se mantiene igual

Firebase Authentication, `src/lib/session.ts`, `src/actions/session.ts`,
`src/lib/slots.ts`, `src/middleware.ts`, `src/lib/mailer.ts`, estructura de
páginas/componentes, `CRON_SECRET` y el endpoint `/api/cron/reminders`.

## Semilla de datos (`prisma/seed.ts` → `scripts/seed-firestore.ts`)

Mismo contenido de datos de ejemplo (3 negocios, sus servicios/profesionales/
horarios, 1 cliente con 3 turnos), reescrito con `getAdminDb().collection(...).doc(...).set(...)`
en vez de `prisma.<modelo>.create`. `getOrCreateFirebaseUser` no cambia (ya
usa el Admin SDK de Auth). El script pasa a vivir en `scripts/` (ya no hay
carpeta `prisma/`) y se invoca igual, `npm run db:seed`.

## Testing / verificación

- `npx tsc --noEmit` limpio (como ya se viene verificando en este proyecto).
- `npm run build` completa sin errores.
- Verificación manual end-to-end contra el Firestore real (ya que no hay
  entorno de test automatizado en el proyecto): registro de negocio y de
  cliente, reservar un turno, verlo en `/mis-turnos` y en `/panel/agenda`,
  cancelarlo, correr `npm run reminders:send` manualmente.

# Panel de administración — estadísticas generales

## Contexto

Turnia ya define un rol `ADMIN` en el modelo de datos (`Role = "CLIENTE" | "NEGOCIO" | "ADMIN"`) pero nunca se implementó ninguna pantalla para ese rol. El dueño de la plataforma quiere poder ver, de un vistazo, cuántos negocios/clientes/turnos hay y cómo viene creciendo el uso — como base para una futura decisión de cobro (hoy la plataforma es gratuita).

## Alcance

**Adentro:**
- Página `/admin` con números generales: negocios (total y publicados), clientes, turnos por estado, y altas por semana de negocios/clientes (últimas 8 semanas).
- Guard de acceso (`requireAdminUser()`), igual patrón que `requireBusinessUser`/`requireClientUser`.
- Link "Admin" en el navbar, visible sólo para `role === "ADMIN"`.
- Promoción de la cuenta `search0.0@gmail.com` (uid `1mRoh4eRx3hTobpwQSbCWuWrYwk1`, ya existe en Firebase Auth pero sin perfil en Firestore) a `role: "ADMIN"`.

**Afuera de este alcance** (explícitamente descartado por el dueño para v1, ver conversación previa):
- Listado de negocios con datos de contacto individuales.
- Exportar contactos a CSV.
- Ver/gestionar el detalle de un negocio puntual desde el admin.
- Cualquier gráfico o librería de charts — sólo números y una tabla simple.
- Cualquier flujo de cobro/facturación real (la plataforma sigue sin integración de pagos).

## Arquitectura

Mismo patrón que el resto de la app: todo el cálculo pasa por el servidor (Server Component), sin infraestructura nueva (nada de Cloud Functions, nada de una colección de estadísticas precomputadas). A la escala actual (decenas de negocios), consultar Firestore en el momento cada vez que se carga `/admin` es correcto y más simple que mantener contadores sincronizados.

## Datos a mostrar

- **Negocios**: total, y cuántos están `published: true`.
- **Clientes**: total de usuarios con `role: "CLIENTE"`.
- **Turnos por estado**: cantidad en cada uno de `PENDIENTE`, `CONFIRMADO`, `CANCELADO`, `COMPLETADO`.
- **Altas por semana** (últimas 8 semanas, semana actual incluida): para negocios y para clientes por separado, cuántos se registraron cada semana. Se calcula agrupando por `createdAt` en memoria (no hay agregación por semana en Firestore) — a este volumen de datos (fetch completo de `turnia_businesses` y de los usuarios con `role: "CLIENTE"`) es trivial.

## Capa de acceso a datos

`src/lib/db/adminStats.ts`, una sola función exportada:

```ts
export interface PlatformStats {
  businesses: { total: number; published: number };
  clients: number;
  appointmentsByStatus: Record<AppointmentStatus, number>;
  weeklySignups: { weekStart: string; businesses: number; clients: number }[]; // 8 entradas, más vieja primero
}

export async function getPlatformStats(): Promise<PlatformStats>
```

Implementación: usa Firestore `.count()` (agregación, sin traer documentos) para los totales simples (negocios total/publicados, turnos por estado — 4 counts, uno por status). Para clientes y altas semanales, trae los usuarios con `role: "CLIENTE"` (sólo `createdAt`, vía `.select("createdAt")`) y los negocios (sólo `createdAt`), y agrupa en memoria por semana ISO.

## Guard de acceso

`src/lib/session.ts` gana una función más, mismo patrón que las existentes:

```ts
export async function requireAdminUser() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}
```

## Páginas

- `src/app/admin/layout.tsx`: llama `requireAdminUser()`, redirige a `/login?callbackUrl=/admin` si no hay acceso. Encabezado simple ("Panel de administración").
- `src/app/admin/page.tsx`: llama `getPlatformStats()` y renderiza tarjetas de números (mismo componente visual `card` ya usado en `/panel`) + una tabla de altas por semana.

## Navbar

En `src/components/navbar.tsx`, agregar (desktop y mobile) un link a `/admin` visible sólo cuando `user?.role === "ADMIN"`, siguiendo el mismo patrón condicional que ya existe para `NEGOCIO`/`CLIENTE`.

## Alta de la cuenta admin

Script puntual (no forma parte de ninguna UI): crea `turnia_users/1mRoh4eRx3hTobpwQSbCWuWrYwk1` con `role: "ADMIN"`, `email: "search0.0@gmail.com"`, nombre por defecto ("Admin", editable a mano después ya que no hay UI de edición de perfil propio todavía).

## Testing / verificación

Igual que el resto del proyecto: sin framework de tests automatizado. Verificación via `tsc`/`build` y un script puntual contra Firestore real que cree datos de negocios/clientes/turnos de prueba con `createdAt` en distintas semanas y confirme que `getPlatformStats()` los agrupa correctamente. Verificación manual de `/admin` en el navegador logueado como la cuenta admin.

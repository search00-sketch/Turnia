# Panel de administración — gestión de negocios

## Contexto

El panel de admin (`/admin`) ya muestra números generales de la plataforma. El dueño de la plataforma ahora quiere, desde el mismo panel, poder ver el listado completo de negocios con sus datos de contacto y antigüedad, darlos de baja del marketplace si hace falta, y llevar un registro manual de si pagaron el servicio (no hay pasarela de pago integrada, y no está en el alcance agregarla ahora).

## Alcance

**Adentro:**
- Página `/admin/negocios`: tabla con todos los negocios (publicados y no), con nombre, categoría, contacto del dueño (nombre/email/teléfono), fecha de alta, estado de publicación, y estado de pago.
- Publicar/despublicar un negocio desde ahí (reutiliza el campo `published` existente).
- Campo `paidUntil` (fecha, opcional) por negocio, editable a mano desde esta pantalla.

**Afuera de este alcance** (decisiones ya tomadas en la conversación previa):
- Pasarela de pago real / cobro automático — sigue sin implementarse, esto es sólo un registro manual para que el dueño de la plataforma sepa a quién cobrarle por fuera.
- "Dar de baja" NO bloquea el login del dueño del negocio a su `/panel` — sólo lo oculta del marketplace público. Bloqueo completo de acceso queda para una vuelta futura si hace falta.
- Editar los demás datos del negocio (servicios, horarios, profesionales) desde el admin — el dueño sigue siendo quien administra eso desde su propio panel.

## Modelo de datos

`BusinessDoc` (`src/lib/db/businesses.ts`) gana un campo:

```ts
paidUntil: Date | null;
```

Un solo campo, sin un enum de estado separado (evita que el estado y la fecha queden inconsistentes entre sí). El estado a mostrar se deriva en la UI:
- `paidUntil` es `null` → **Gratis**
- `paidUntil` es una fecha futura → **Pagado hasta {fecha}**
- `paidUntil` es una fecha pasada → **Vencido desde {fecha}**

## Capa de acceso a datos

En `src/lib/db/businesses.ts`:
- `mapBusinessDoc` lee el nuevo campo (`paidUntil: data.paidUntil ? data.paidUntil.toDate() : null`).
- `updateBusiness`'s `Partial<{...}>` gana `paidUntil: Date | null`.
- Nueva función `getAllBusinessesWithOwners()`: trae **todos** los negocios (sin filtrar por `published`, a diferencia de `getPublishedBusinesses`) e hidrata el `owner` (nombre/email/teléfono desde `turnia_users`, vía `db.getAll(...refs)` igual que `hydrateForClient`/`hydrateForBusiness` en `appointments.ts`), ordenados por `createdAt` descendente.

## Server Actions

`src/actions/admin.ts` (nuevo archivo), gateado con `requireAdminUser()` (no con el chequeo de "es dueño de este negocio" que usan las acciones de `/panel` — acá el admin opera sobre cualquier negocio, así que recibe el `businessId` como parámetro explícito):

```ts
export async function adminSetBusinessPublished(businessId: string, published: boolean): Promise<ActionResult>
export async function adminSetBusinessPaidUntil(businessId: string, paidUntilISO: string | null): Promise<ActionResult>
```

Ambas llaman a `updateBusiness()` (ya existente, sin chequeo de ownership propio — la autorización vive en la Server Action, mismo patrón que el resto del proyecto) y hacen `revalidatePath("/admin/negocios")`.

## Página

`src/app/admin/negocios/page.tsx`: Server Component que llama `getAllBusinessesWithOwners()` y renderiza una tabla. Cada fila es un componente cliente chico (`src/components/admin-business-row.tsx`) con:
- Botón que alterna Publicar/Despublicar (llama `adminSetBusinessPublished`).
- Un `<input type="date">` + botón Guardar para `paidUntil` (llama `adminSetBusinessPaidUntil`; input vacío = `null` = Gratis).

Se agrega un link "Negocios" en el layout de `/admin` (o directo en la página `/admin`) para llegar a esta pantalla.

## Testing / verificación

Mismo enfoque que el resto del proyecto: sin framework de tests automatizado. Verificación via `tsc`/`build`, un script puntual contra Firestore real que cree un negocio de prueba y confirme que `getAllBusinessesWithOwners()` lo trae con el owner correctamente hidratado y que `adminSetBusinessPublished`/`adminSetBusinessPaidUntil` escriben lo esperado, y una pasada manual en el navegador (con la cuenta ADMIN ya creada) confirmando que un CLIENTE/negocio no puede acceder a estas acciones ni a la página.

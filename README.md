# Turnia

Plataforma de reservas de turnos online para negocios de belleza y bienestar (peluquerías, barberías, spas, centros de estética, etc.), inspirada en el funcionamiento de [Wonoma](https://www.wonoma.com): un sitio público donde los clientes buscan negocios y reservan turnos paso a paso, y un panel privado donde cada negocio gestiona sus servicios, profesionales, horarios y turnos.

No es una copia 1:1 de Wonoma (nombre, marca y contenidos son propios), sino una aplicación construida desde cero que replica el flujo y las funcionalidades clave.

## Qué incluye

- **Marketplace público**: home con búsqueda y categorías, listado de negocios con filtros, ficha de cada negocio con sus servicios agrupados por categoría.
- **Reserva de turnos paso a paso**: Servicio → Profesional (o "cualquiera disponible") → Fecha → Hora → Confirmar, calculando en el momento los horarios realmente disponibles según el horario de atención del negocio y los turnos ya ocupados.
- **Cuentas de cliente**: registro/login con Firebase Authentication, y sección "Mis turnos" para ver próximos turnos, historial, y cancelar.
- **Panel del negocio**: cada negocio tiene su propio login y administra su agenda (por día, con cambio de estado de cada turno), sus servicios (con categoría, precio y duración), sus profesionales, sus horarios de atención y los datos de su ficha pública.
- **Contabilidad del negocio** (`/panel/contabilidad`): estado de resultados mensual con ingresos, gastos, ganancia neta y margen, desglosado por cada servicio/producto. Los ingresos salen solos de los turnos marcados como realizados (con el precio y el costo por turno del servicio), y el negocio puede cargar a mano gastos (insumos, alquiler, sueldos...) e ingresos extra (venta de productos), imputados a un servicio o agrupados por concepto.
- **Emails automáticos**: confirmación al reservar (a cliente y a negocio) y recordatorio ~24hs antes del turno.
- **Multi-negocio**: es una sola plataforma donde pueden convivir todos los negocios, cada uno con sus propios datos, agenda y usuarios, completamente aislados entre sí.

Quedó **fuera de este alcance** (podés pedir que se sume más adelante): pagos o señas online, integración real con WhatsApp Business, tienda de productos, app mobile.

## Stack técnico

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Firebase Authentication** para el login/registro de clientes y negocios, y **Cloud Firestore** como única base de datos de la app (perfiles, negocios, servicios, profesionales, horarios y turnos). Todo el acceso a Firestore pasa por el servidor (Server Actions / Server Components vía el Admin SDK, `firebase-admin`) — el navegador nunca lo consulta directo, así que no hace falta mantener Firestore Security Rules de datos.
- **Nodemailer** para el envío de emails.

> Las colecciones de Firestore que usa esta app están todas prefijadas `turnia_` (`turnia_users`, `turnia_businesses`, `turnia_services`, `turnia_professionals`, `turnia_businessHours`, `turnia_appointments`, `turnia_movements`, `turnia_businessSlugs`) porque el proyecto de Firebase puede estar compartido con otra app en la misma cuenta. **Si en algún momento hace falta escribir Firestore Security Rules reales** (por ejemplo, para permitir acceso directo desde el navegador), hacelo sólo sobre esas colecciones `turnia_*` — nunca despliegues un `firestore.rules` que no incluya explícitamente las reglas de cualquier otra app que viva en el mismo proyecto, o le vas a cortar el acceso a sus propios datos.

## 1. Crear el proyecto de Firebase

Turnia sólo necesita un proyecto de Firebase (Authentication + Firestore). No hace falta ninguna base de datos externa.

1. Creá un proyecto en la [consola de Firebase](https://console.firebase.google.com) (o usá uno existente).
2. **Authentication** → pestaña "Sign-in method" → habilitá el proveedor **Correo electrónico/contraseña**.
3. **Firestore Database** → creá la base si todavía no existe (modo producción; las reglas de datos no importan para esta app porque nunca se accede desde el navegador).
4. **Configuración del proyecto** (ícono de engranaje) → pestaña "General" → sección "Tus apps" → agregá una app **Web** (el ícono `</>`). Ahí te va a mostrar un objeto `firebaseConfig` con `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`: son los 6 valores `NEXT_PUBLIC_FIREBASE_*` del paso 2. Son públicos, no pasa nada si quedan visibles en el navegador.
5. **Configuración del proyecto** → pestaña "Cuentas de servicio" → botón "Generar nueva clave privada". Se descarga un `.json` con `project_id`, `client_email` y `private_key`: son `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY` del paso 2. **Estas sí son secretas** (le dan a quien las tenga acceso total a administrar Authentication y Firestore de ese proyecto): no las subas al repo ni las compartas.

## 2. Puesta en marcha en tu computadora

Necesitás [Node.js](https://nodejs.org) 18 o superior y el [CLI de Firebase](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`, y `firebase login`).

```bash
npm install                        # instala dependencias
cp .env.example .env                # completá .env con los valores del paso 1 (ver abajo)
firebase deploy --only firestore:indexes   # crea los índices compuestos que necesita la app
npm run db:seed                     # carga 3 negocios de ejemplo + un cliente, en Firestore Y en Firebase Auth
npm run dev                         # arranca en http://localhost:3000
```

`npm install` necesita acceso normal a internet. Si en algún paso ves un error de red, volvé a correr el mismo comando: es seguro repetirlo.

`npm run db:seed` crea los usuarios de prueba tanto en Firestore como en Firebase Authentication (usa el Admin SDK, por eso necesita `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` ya cargados en `.env`). Es seguro volver a correrlo: si un negocio con el mismo slug ya existe, no lo vuelve a crear (ni sus turnos de ejemplo).

### 2.a Variables de entorno (`.env`)

Completá `.env` (a partir de `.env.example`) con:

- `NEXT_PUBLIC_FIREBASE_*` (6 valores) y `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`: del paso 1. Ojo con `FIREBASE_PRIVATE_KEY`: en el `.json` descargado tiene saltos de línea reales; al pegarla en `.env` como string de una sola línea se representan como `\n` literales (así vienen en `.env.example`) — el código ya se encarga de convertirlos de vuelta.
- `NEXT_PUBLIC_APP_NAME`: nombre de la plataforma, se muestra en toda la app.
- `CRON_SECRET`: cualquier valor random, por ejemplo generado con `openssl rand -base64 32`. Protege el endpoint de recordatorios para que no lo dispare cualquiera.
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM`: credenciales de un servicio de email (Gmail, [Resend](https://resend.com), SendGrid, etc.). **Si los dejás vacíos, los emails no se envían de verdad: quedan simulados y se imprimen en la consola del servidor**, así podés probar todo el flujo sin configurar nada de esto todavía.

### Usuarios de prueba (después de `npm run db:seed`)

Contraseña para todos: `demo1234`

| Rol | Email | Negocio |
|---|---|---|
| Negocio | maria@nuevaimagen.com | Nueva Imagen Peluquería |
| Negocio | diego@elzorro.com | Barbería El Zorro |
| Negocio | carla@spaolivos.com | Spa Bienestar Olivos |
| Cliente | juan@cliente.com | — (tiene turnos ya reservados) |

## Cómo se ve cada rol

- **Cliente**: entra por `/`, busca en `/negocios`, reserva desde la ficha de un negocio, y gestiona sus turnos en `/mis-turnos`.
- **Dueño de negocio**: se registra en `/registro-negocio` (o vos lo cargás por él) y accede a su panel en `/panel`, con secciones para Agenda, Servicios, Profesionales, Horarios y los datos de Mi negocio.

Para sumar un negocio nuevo, lo más simple es que se registre desde `/registro-negocio`: en un solo formulario crea su usuario y su ficha de negocio (arranca con horario de lunes a sábado 10 a 20hs, cargable después).

## Recordatorios automáticos

El envío de recordatorios (`/api/cron/reminders`) no corre solo: hay que dispararlo periódicamente. Dos formas:

1. **Desplegando en Vercel**: el proyecto ya incluye `vercel.json` con un cron configurado a `0 13 * * *` (una vez por día, 13:00 UTC ≈ 10hs Argentina). Es una corrida por día porque el plan gratuito (Hobby) de Vercel no permite crons más frecuentes — si tenés plan Pro podés cambiarlo a algo como `0 * * * *` (cada hora) para que los recordatorios salgan con mayor precisión respecto a la hora del turno (`sendDueReminders()` en `src/lib/reminders.ts` ya contempla ambos casos: revisa todo lo que empieza dentro de las próximas ~24hs y no manda el mismo recordatorio dos veces). Sólo necesitás tener definida la variable de entorno `CRON_SECRET` en el proyecto de Vercel (Vercel manda automáticamente `Authorization: Bearer <CRON_SECRET>` en cada llamada del cron).
2. **Con tu propio servidor / cualquier otro hosting**: corré `npm run reminders:send` desde un cron tradicional, por ejemplo una vez por día:
   ```
   0 13 * * *  cd /ruta/al/proyecto && npm run reminders:send >> reminders.log 2>&1
   ```
   O apuntá un servicio externo (como cron-job.org, que sí permite frecuencia horaria gratis) a `https://tu-dominio.com/api/cron/reminders?secret=TU_CRON_SECRET` cada 1 hora si querés más precisión sin pagar Vercel Pro.

## 3. Desplegar en producción (Vercel)

1. **Subir el código a GitHub**: creá un repositorio nuevo (podés dejarlo privado) y subí el contenido de esta carpeta.
   ```bash
   git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
   git push -u origin main
   ```
2. **Importar el proyecto en Vercel**: [vercel.com/new](https://vercel.com/new) → elegí el repo recién subido → Vercel detecta que es Next.js automáticamente, no hace falta tocar nada del build.
3. **Cargar las variables de entorno**: en la pantalla de importación (o después, en Project Settings → Environment Variables) cargá **todas** las variables de tu `.env` local, con los mismos valores reales.
4. **Deploy**. Vercel corre `npm install` y `npm run build`.
5. **Índice de Firestore**: si todavía no lo desplegaste, corré `firebase deploy --only firestore:indexes` una vez (desde tu computadora, con el CLI de Firebase logueado y el proyecto correcto seleccionado en `.firebaserc`).
6. **Firebase**: en la consola de Firebase, Authentication → Settings → "Authorized domains", agregá el dominio que te asignó Vercel (`tu-proyecto.vercel.app`, y tu dominio propio si le configurás uno). Sin este paso, Firebase va a rechazar los logins que vengan desde ese dominio.

### Checklist para probar después del deploy

- [ ] Registro de cliente (`/registro`) crea el usuario y te deja logueado.
- [ ] Registro de negocio (`/registro-negocio`) crea el usuario, el negocio y te lleva a `/panel`.
- [ ] Reservar un turno como cliente (`/negocios/[slug]/reservar`) y que aparezca en `/mis-turnos`.
- [ ] El turno aparece en `/panel/agenda` del negocio correspondiente.
- [ ] Cancelar el turno desde `/mis-turnos` (o cambiarle el estado desde `/panel/agenda`) se refleja en ambos lados.
- [ ] Si cargaste SMTP real: llegan los emails de confirmación al cliente y al negocio.

### Si algo falla en el deploy

- **"auth/invalid-api-key" o pantalla de login rota**: te falta cargar alguno de los 6 `NEXT_PUBLIC_FIREBASE_*` en Vercel, o tiene un typo. Como son públicas podés verificarlas abriendo la consola del navegador en `/login`.
- **El login funciona pero da error al crear la sesión o al leer/guardar datos**: revisá `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` (Admin SDK). El error más común es la `PRIVATE_KEY` mal pegada — tiene que conservar los `\n` tal como los copiaste del `.json` de la cuenta de servicio.
- **Error "the query requires an index"** (por ejemplo al abrir `/panel/contabilidad`): falta desplegar algún índice compuesto — corré `firebase deploy --only firestore:indexes`.
- **No llegan los emails**: sin `SMTP_*` configurado, los emails se simulan (se imprimen en los logs de Vercel, no se envían). Revisá los logs de la función antes de asumir que algo está roto.
- **Los recordatorios no se envían solos**: confirmá que `CRON_SECRET` esté cargado en Vercel — sin él, el cron job configurado en `vercel.json` responde 401 y no manda nada.

## Notas técnicas

- **Autenticación**: Firebase Authentication es dueño de la identidad (email + contraseña) de clientes y negocios. Firestore guarda el perfil de cada usuario (nombre, rol, negocio si corresponde) con el documento indexado por el `uid` de Firebase. El servidor verifica cada request con una cookie de sesión httpOnly (creada a partir del ID token de Firebase), no con el ID token directamente — así no hace falta volver a hablar con Firebase en cada página.
- **Disponibilidad de turnos**: se calcula en `src/lib/slots.ts` a partir del horario de atención del día, la duración del servicio, y los turnos ya confirmados de cada profesional. La reserva en sí (`src/lib/db/appointments.ts`, `createAppointmentTx`) corre dentro de una transacción de Firestore que vuelve a chequear disponibilidad antes de escribir, para evitar que dos personas reserven el mismo horario en simultáneo.
- **Unicidad del slug de negocio**: como Firestore no tiene constraints únicas como Postgres, la unicidad del slug (`/negocios/{slug}`) se garantiza reservándolo atómicamente en una transacción (`turnia_businessSlugs/{slug}`) al crear el negocio.
- **Contabilidad**: cada servicio tiene un "costo por turno" opcional (insumos, comisión del profesional, etc.). Al reservar, el turno guarda una copia del precio y del costo del servicio en ese momento, así cambiar un precio después no modifica la contabilidad de meses anteriores (los turnos creados antes de esta función usan el precio/costo actual del servicio). Un turno cuenta como ingreso recién cuando el negocio lo marca como realizado (`COMPLETADO`). El cálculo está en `src/lib/accounting.ts` (función pura, sin acceso a Firestore) y los gastos/ingresos manuales viven en la colección `turnia_movements`.
- **Roles**: `CLIENTE`, `NEGOCIO` (y `ADMIN` reservado para un futuro panel de super-administración de la plataforma, no implementado todavía).

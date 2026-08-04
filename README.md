# Turnia

Directorio de negocios locales (peluquerías, barberías, spas, etc.). Cada
negocio se registra, inicia sesión y carga/edita su propia ficha — vos no
tenés que tocar nada a mano.

Es un sitio **100% estático** (HTML + CSS + JS, sin servidor propio) que
usa **Firebase Authentication** para el login de cada negocio y **Cloud
Firestore** como base de datos. Funciona entero en el plan gratuito
**Spark** de Firebase — no hace falta activar facturación (Blaze).

> Nota: el proyecto anterior (Next.js + Prisma + Postgres, con reservas de
> turnos) sigue en este repo (carpetas `src/`, `prisma/`, etc.) pero ya no
> se usa. Se puede borrar cuando quieran; se dejó intacto por las dudas.

## Estructura

```
public/               ← esto es todo el sitio (lo que se despliega)
  index.html           Directorio público de negocios
  login.html            Login / registro de negocio
  panel.html            Panel privado: cada negocio edita su ficha
  css/styles.css        Estilos compartidos
  js/
    firebase-config.js  Config pública del proyecto de Firebase
    firebase-init.js    Inicializa Firebase (app, auth, db)
    categories.js        Lista de rubros
    index.js              Lógica del directorio público
    login.js               Lógica de login/registro
    panel.js                Lógica del panel de cada negocio

firestore.rules        Reglas de seguridad de la base de datos
firebase.json           Config de Firebase Hosting + Firestore
.firebaserc              Qué proyecto de Firebase usar (coyote-house)
```

## Cómo funciona

- **Login de negocios**: `login.html` usa Firebase Authentication
  (email + contraseña). Al registrarse se crea el usuario y, en el mismo
  paso, un documento en Firestore `businesses/{uid}` — usando como ID el
  mismo `uid` que le asignó Firebase Auth al negocio.
- **Panel**: `panel.html` sólo se puede ver logueado. Carga el documento
  `businesses/{uid}` del negocio conectado, permite editarlo (nombre,
  rubro, descripción, contacto, servicios) y guardarlo. Tiene un switch
  para "Publicar" — mientras no lo activen, el negocio no aparece en el
  directorio público (así no se ve una ficha vacía recién creada).
- **Directorio público**: `index.html` lee de Firestore todos los
  negocios con `published == true` y los muestra en tarjetas, con
  búsqueda por texto y filtro por rubro. No requiere login.
- **Seguridad**: todo pasa por `firestore.rules`. La regla clave es:

  ```
  match /businesses/{businessId} {
    allow read: if true;
    allow write: if request.auth != null && request.auth.uid == businessId;
  }
  ```

  Como el ID del documento es el `uid` del dueño, la regla garantiza que
  cada negocio sólo puede escribir su propia ficha — nunca la de otro.
  Todo el mundo puede leer (para que el directorio público funcione sin
  login).

  El proyecto de Firebase (`coyote-house`) es compartido con otra app que
  ya tenían (una app de auditoría, con su propia colección `users/`). Esa
  regla se dejó exactamente como estaba — Turnia no la toca para nada,
  usa únicamente la colección `businesses`.

## Probarlo en local

No hace falta build ni npm. Basta con levantar un servidor estático
apuntando a `public/` (abrir los `.html` directo con doble clic no
funciona bien porque son módulos de JS). Con Node instalado:

```
npx serve public
```

o con Python:

```
cd public && python3 -m http.server 8080
```

y abrir `http://localhost:8080`.

## Desplegar a Firebase Hosting

1. Instalar la CLI de Firebase (una sola vez):
   ```
   npm install -g firebase-tools
   ```
2. Iniciar sesión:
   ```
   firebase login
   ```
3. Crear el sitio de Hosting "turnia" dentro del proyecto (una sola vez;
   si ya existe, este comando tira un error que se puede ignorar):
   ```
   firebase hosting:sites:create turnia
   ```
   El nombre de sitio es único a nivel global de Firebase (no sólo dentro
   del proyecto). Si "turnia" ya está tomado por otro proyecto de otra
   persona, hay que elegir otro (ej. `turnia-app`, `mi-turnia`) y
   actualizar `turnia` por ese nombre en `firebase.json` y `.firebaserc`.
4. Desde la carpeta del proyecto, publicar las reglas de Firestore y el
   sitio:
   ```
   firebase deploy --only firestore:rules,hosting
   ```

Con eso el sitio queda online en `https://turnia.web.app` (y
`https://turnia.firebaseapp.com`). Todo esto usa el plan Spark (gratis) —
no pide tarjeta ni facturación.

## Cuentas de prueba

No hay cuentas precargadas: cada negocio se crea la suya desde
`login.html` → "Crear cuenta de negocio". Podés crear una de prueba ahí
mismo para ver el panel funcionando.

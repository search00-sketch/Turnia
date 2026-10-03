import { initializeApp, getApps, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

// Next.js renderiza los componentes "use client" también en el servidor (para generar
// el HTML inicial), incluso durante el build si la página se puede pre-renderizar de forma
// estática. getAuth() valida el formato de las env vars públicas de Firebase y tira una
// excepción si están vacías o mal formadas — algo que pasaría en cada build hasta que
// cargues las credenciales reales de Firebase.
//
// Por eso acá NO inicializamos nada a nivel de módulo: getFirebaseAuth() crea la instancia
// recién la primera vez que se llama, y en este proyecto sólo se llama desde manejadores de
// eventos (submit de formularios, click de "cerrar sesión"), que sólo se ejecutan en el
// navegador. Así el build nunca se rompe por esto, sin importar si ya cargaste las
// credenciales de Firebase o no.
export function getFirebaseAuth(): Auth {
  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  }
  if (!auth) {
    auth = getAuth(app);
    // Mails de Firebase (confirmación de email) y ventana de Google en español.
    auth.languageCode = "es";
    // Sólo para desarrollo/pruebas con el emulador de Firebase (nunca se define en producción).
    const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
    if (emulatorHost) {
      connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
    }
  }
  return auth;
}

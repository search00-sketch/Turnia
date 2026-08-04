// Inicializa Firebase una sola vez y exporta las instancias que necesita
// el resto del sitio. Se carga como módulo ES directo desde el CDN de
// Google (gstatic) — no hace falta bundler ni npm para el sitio estático.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

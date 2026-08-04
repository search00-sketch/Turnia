// Login / registro de negocios. Al registrarse se crea el usuario en
// Firebase Auth y, en el mismo paso, el documento del negocio en
// Firestore (businesses/{uid}) — todavía sin publicar hasta que el
// dueño complete los datos en el panel.
import { auth, db } from "./firebase-init.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    tabPanels.forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

function friendlyError(err) {
  const code = err?.code || "";
  const map = {
    "auth/email-already-in-use": "Ya existe una cuenta con ese email. Probá iniciar sesión.",
    "auth/invalid-email": "El email no es válido.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/user-not-found": "No encontramos una cuenta con ese email.",
    "auth/wrong-password": "La contraseña es incorrecta.",
    "auth/invalid-credential": "Email o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Esperá un momento y probá de nuevo.",
  };
  return map[code] || "Algo salió mal. Probá de nuevo.";
}

// --- Login ---
const loginForm = document.getElementById("login-form");
const loginMsg = document.getElementById("login-msg");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMsg.textContent = "";
  loginMsg.className = "form-msg";
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  const email = loginForm.email.value.trim();
  const password = loginForm.password.value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "panel.html";
  } catch (err) {
    loginMsg.textContent = friendlyError(err);
    loginMsg.classList.add("error");
    submitBtn.disabled = false;
  }
});

// --- Registro ---
const registerForm = document.getElementById("register-form");
const registerMsg = document.getElementById("register-msg");

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  registerMsg.textContent = "";
  registerMsg.className = "form-msg";
  const submitBtn = registerForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  const businessName = registerForm.businessName.value.trim();
  const email = registerForm.email.value.trim();
  const password = registerForm.password.value;

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "businesses", cred.user.uid), {
      ownerUid: cred.user.uid,
      ownerEmail: email,
      name: businessName,
      category: "",
      description: "",
      address: "",
      phone: "",
      whatsapp: "",
      services: [],
      published: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    window.location.href = "panel.html";
  } catch (err) {
    registerMsg.textContent = friendlyError(err);
    registerMsg.classList.add("error");
    submitBtn.disabled = false;
  }
});

// Si ya está logueado, no tiene sentido ver el login: directo al panel.
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "panel.html";
  }
});

// Panel de autogestión del negocio: cada dueño edita únicamente su propio
// documento en businesses/{uid}. La regla de Firestore ya garantiza que
// nadie pueda tocar el negocio de otro; acá sólo resolvemos la UI.
import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { CATEGORIES } from "./categories.js";

const loadingState = document.getElementById("loading-state");
const panelContent = document.getElementById("panel-content");
const form = document.getElementById("business-form");
const categorySelectEl = document.getElementById("category");
const servicesList = document.getElementById("services-list");
const addServiceBtn = document.getElementById("add-service");
const publishToggle = document.getElementById("published");
const publishLabel = document.getElementById("publish-label");
const saveMsg = document.getElementById("save-msg");
const logoutBtn = document.getElementById("logout-btn");
const ownerEmailEl = document.getElementById("owner-email");
const publicLink = document.getElementById("public-link");

let currentUid = null;

categorySelectEl.innerHTML =
  `<option value="">Elegí un rubro</option>` +
  CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");

function addServiceRow(service = { name: "", price: "", duration: "" }) {
  const row = document.createElement("div");
  row.className = "service-row";
  row.innerHTML = `
    <input type="text" placeholder="Servicio (ej: Corte de pelo)" class="service-name" value="${service.name ?? ""}" />
    <input type="number" placeholder="Precio" min="0" step="1" class="service-price" value="${service.price ?? ""}" />
    <input type="number" placeholder="Minutos" min="0" step="5" class="service-duration" value="${service.duration ?? ""}" />
    <button type="button" class="remove-service">Quitar</button>
  `;
  row.querySelector(".remove-service").addEventListener("click", () => row.remove());
  servicesList.appendChild(row);
}

addServiceBtn.addEventListener("click", () => addServiceRow());

function collectServices() {
  return Array.from(servicesList.querySelectorAll(".service-row"))
    .map((row) => ({
      name: row.querySelector(".service-name").value.trim(),
      price: Number(row.querySelector(".service-price").value) || 0,
      duration: Number(row.querySelector(".service-duration").value) || 0,
    }))
    .filter((s) => s.name);
}

function updatePublishLabel() {
  publishLabel.textContent = publishToggle.checked
    ? "Publicado — se ve en el directorio"
    : "Sin publicar — sólo vos lo ves";
}
publishToggle.addEventListener("change", updatePublishLabel);

async function loadBusiness(uid) {
  const ref = doc(db, "businesses", uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};

  form.name.value = data.name || "";
  categorySelectEl.value = data.category || "";
  form.description.value = data.description || "";
  form.address.value = data.address || "";
  form.phone.value = data.phone || "";
  form.whatsapp.value = data.whatsapp || "";
  publishToggle.checked = !!data.published;
  updatePublishLabel();

  servicesList.innerHTML = "";
  const services = Array.isArray(data.services) ? data.services : [];
  if (services.length === 0) {
    addServiceRow();
  } else {
    services.forEach(addServiceRow);
  }

  ownerEmailEl.textContent = auth.currentUser?.email || "";
  publicLink.href = `index.html`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUid) return;
  saveMsg.textContent = "";
  saveMsg.className = "form-msg";
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  const payload = {
    ownerUid: currentUid,
    ownerEmail: auth.currentUser?.email || "",
    name: form.name.value.trim(),
    category: categorySelectEl.value,
    description: form.description.value.trim(),
    address: form.address.value.trim(),
    phone: form.phone.value.trim(),
    whatsapp: form.whatsapp.value.trim(),
    services: collectServices(),
    published: publishToggle.checked,
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, "businesses", currentUid), payload, { merge: true });
    saveMsg.textContent = "Guardado ✓";
    saveMsg.classList.add("success");
  } catch (err) {
    console.error(err);
    saveMsg.textContent = "No se pudo guardar. Probá de nuevo.";
    saveMsg.classList.add("error");
  } finally {
    submitBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUid = user.uid;
  await loadBusiness(user.uid);
  loadingState.hidden = true;
  panelContent.hidden = false;
});

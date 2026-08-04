// Lógica de la página pública: carga los negocios publicados desde
// Firestore y los pinta en la grilla, con búsqueda y filtro por rubro.
import { db, auth } from "./firebase-init.js";
import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { CATEGORIES } from "./categories.js";

const grid = document.getElementById("grid");
const emptyState = document.getElementById("empty-state");
const searchInput = document.getElementById("search");
const categorySelect = document.getElementById("category-filter");
const headerAuthLink = document.getElementById("header-auth-link");

let allBusinesses = [];

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function renderCard(biz) {
  const services = Array.isArray(biz.services) ? biz.services : [];
  const servicesPreview = services
    .slice(0, 3)
    .map((s) => escapeHtml(s.name))
    .filter(Boolean)
    .join(" · ");

  const contactLines = [];
  if (biz.address) {
    contactLines.push(`<span>📍 ${escapeHtml(biz.address)}</span>`);
  }
  if (biz.phone) {
    contactLines.push(`<span>📞 ${escapeHtml(biz.phone)}</span>`);
  }
  if (biz.whatsapp) {
    const digits = biz.whatsapp.replace(/[^\d]/g, "");
    contactLines.push(
      `<span>💬 <a href="https://wa.me/${digits}" target="_blank" rel="noopener">WhatsApp</a></span>`
    );
  }

  return `
    <article class="card">
      ${biz.category ? `<span class="badge">${escapeHtml(biz.category)}</span>` : ""}
      <h3>${escapeHtml(biz.name || "Negocio sin nombre")}</h3>
      ${biz.description ? `<p class="desc">${escapeHtml(biz.description)}</p>` : ""}
      ${contactLines.length ? `<div class="meta">${contactLines.join("")}</div>` : ""}
      ${
        servicesPreview
          ? `<div class="services-preview"><strong>Servicios:</strong> ${servicesPreview}${
              services.length > 3 ? "…" : ""
            }</div>`
          : ""
      }
    </article>
  `;
}

function populateCategoryFilter() {
  const used = new Set(allBusinesses.map((b) => b.category).filter(Boolean));
  const options = CATEGORIES.filter((c) => used.has(c));
  categorySelect.innerHTML =
    `<option value="">Todos los rubros</option>` +
    options.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

function applyFilters() {
  const text = searchInput.value.trim().toLowerCase();
  const category = categorySelect.value;

  const filtered = allBusinesses.filter((biz) => {
    const matchesCategory = !category || biz.category === category;
    const haystack = `${biz.name || ""} ${biz.description || ""}`.toLowerCase();
    const matchesText = !text || haystack.includes(text);
    return matchesCategory && matchesText;
  });

  if (filtered.length === 0) {
    grid.innerHTML = "";
    emptyState.hidden = false;
  } else {
    emptyState.hidden = true;
    grid.innerHTML = filtered.map(renderCard).join("");
  }
}

async function loadBusinesses() {
  try {
    const q = query(collection(db, "businesses"), where("published", "==", true));
    const snap = await getDocs(q);
    allBusinesses = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
    populateCategoryFilter();
    applyFilters();
  } catch (err) {
    console.error("Error cargando negocios:", err);
    grid.innerHTML = `<p class="error">No se pudieron cargar los negocios. Probá de nuevo más tarde.</p>`;
    emptyState.hidden = true;
  }
}

searchInput.addEventListener("input", applyFilters);
categorySelect.addEventListener("change", applyFilters);

onAuthStateChanged(auth, (user) => {
  if (user) {
    headerAuthLink.textContent = "Mi panel";
    headerAuthLink.href = "panel.html";
  } else {
    headerAuthLink.textContent = "Ingresar / Registrarme";
    headerAuthLink.href = "login.html";
  }
});

loadBusinesses();

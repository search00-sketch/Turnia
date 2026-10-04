// Service worker mínimo: sólo existe para que Turnia se pueda instalar como app.
// No guarda nada en caché: turnos y horarios siempre se piden en vivo.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

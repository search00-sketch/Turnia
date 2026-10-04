/** Sólo destinos dentro de la app ("/algo"), nunca otro sitio ("https://..." o "//..."). */
export function safeCallbackUrl(raw: string | null | undefined): string | null {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
}

/**
 * Después de ingresar, registrarse o salir: recarga completa de la página.
 * Con una navegación interna, Next puede reutilizar una versión guardada de
 * antes del login (por ejemplo la redirección de "Mis turnos" al login) y
 * mostrar otra vez la pantalla de ingreso.
 */
export function goAfterAuth(url: string) {
  window.location.assign(url);
}

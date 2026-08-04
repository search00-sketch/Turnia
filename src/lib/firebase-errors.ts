const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Email o contraseña incorrectos.",
  "auth/invalid-email": "El email no es válido.",
  "auth/user-not-found": "Email o contraseña incorrectos.",
  "auth/wrong-password": "Email o contraseña incorrectos.",
  "auth/too-many-requests": "Demasiados intentos. Esperá un momento y volvé a probar.",
  "auth/email-already-in-use": "Ya existe una cuenta con ese email.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/network-request-failed": "Problema de conexión. Revisá tu internet e intentá de nuevo.",
};

export function firebaseErrorMessage(code: unknown): string {
  if (typeof code === "string" && MESSAGES[code]) return MESSAGES[code];
  return "Ocurrió un error. Probá de nuevo.";
}

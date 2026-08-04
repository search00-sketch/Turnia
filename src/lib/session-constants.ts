// Constantes de la cookie de sesión, separadas de session.ts a propósito.
//
// middleware.ts corre en el runtime Edge y sólo necesita el NOMBRE de la cookie
// para decidir si redirige a /login. Si importara esto desde session.ts arrastraría
// también firebase-admin (que depende de módulos nativos de Node como node:https/node:net),
// y el build de Next fallaría al compilar el middleware para el runtime Edge.
export const SESSION_COOKIE_NAME = "session";
// 14 días: es el máximo que permite Firebase para un session cookie.
export const SESSION_COOKIE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

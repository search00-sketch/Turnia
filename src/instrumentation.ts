// Next.js ejecuta register() una vez al iniciar cada instancia del servidor.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/timezone");
  }
}

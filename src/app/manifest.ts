import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — Reservá turnos`,
    short_name: APP_NAME,
    description: "Reservá turnos en peluquerías, barberías, uñas y spas.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f2f6",
    theme_color: "#2a1830",
    lang: "es-AR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

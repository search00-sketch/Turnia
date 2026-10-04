import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import { getCurrentUser } from "@/lib/session";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import TabBar from "@/components/tab-bar";
import { SketchDefs } from "@/components/sketch";
import PwaRegister from "@/components/pwa-register";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: `${APP_NAME} — Reservá turnos online`,
  description:
    "Reservá turnos en peluquerías, barberías, spas y centros de estética. Rápido, fácil y las 24hs.",
  applicationName: APP_NAME,
  // Instalable como app (ver src/app/manifest.ts). En iPhone: Compartir → Agregar a inicio.
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2a1830",
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <html lang="es">
      <body className="font-sans antialiased">
        <SketchDefs />
        <PwaRegister />
        <div className="flex min-h-screen flex-col">
          <Navbar
            user={
              user
                ? { name: user.name, role: user.role, businessSlug: user.business?.slug ?? null }
                : null
            }
          />
          <main className="flex-1">{children}</main>
          <Footer />
          <TabBar role={user?.role ?? null} />
        </div>
      </body>
    </html>
  );
}

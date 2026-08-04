import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: `${APP_NAME} — Reservá turnos online`,
  description:
    "Reservá turnos en peluquerías, barberías, spas y centros de estética. Rápido, fácil y las 24hs.",
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
        </div>
      </body>
    </html>
  );
}

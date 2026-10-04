"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut as firebaseSignOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { clearSessionCookie } from "@/actions/session";

export default function SignOutButton({ className = "btn-ghost" }: { className?: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await firebaseSignOut(getFirebaseAuth());
    } catch {
      // si falla el signOut del cliente igual limpiamos la cookie del servidor
    }
    await clearSessionCookie();
    setSigningOut(false);
    router.push("/");
    router.refresh();
  }

  return (
    <button onClick={handleSignOut} disabled={signingOut} className={className}>
      {signingOut ? "Saliendo..." : "Cerrar sesión"}
    </button>
  );
}

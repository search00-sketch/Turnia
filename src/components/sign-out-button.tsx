"use client";

import { useState } from "react";
import { signOut as firebaseSignOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase-client";
import { clearSessionCookie } from "@/actions/session";
import { goAfterAuth } from "@/lib/callback-url";

export default function SignOutButton({ className = "btn-ghost" }: { className?: string }) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await firebaseSignOut(getFirebaseAuth());
    } catch {
      // si falla el signOut del cliente igual limpiamos la cookie del servidor
    }
    await clearSessionCookie();
    goAfterAuth("/");
  }

  return (
    <button onClick={handleSignOut} disabled={signingOut} className={className}>
      {signingOut ? "Saliendo..." : "Cerrar sesión"}
    </button>
  );
}

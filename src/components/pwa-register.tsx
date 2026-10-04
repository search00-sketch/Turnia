"use client";

import { useEffect } from "react";

/** Registra el service worker mínimo que hace a Turnia instalable como app. */
export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}

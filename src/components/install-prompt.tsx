"use client";

import { useEffect, useState } from "react";
import { IconPlusBox, IconShare, IconX } from "@/components/icons";
import { Sketch } from "@/components/sketch";

// Evento que Chrome/Android dispara cuando la página se puede instalar.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "turnia-install-dismissed";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Aviso "Tené Turnia en tu celular". En Android/Chrome instala con un toque;
 * en iPhone (donde Apple no permite un botón automático) muestra los pasos.
 * No aparece si ya está instalada o si la persona lo cerró.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"hidden" | "android" | "ios">("hidden");
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // sin almacenamiento disponible: igual mostramos el aviso
    }
    if (isIos()) {
      setMode("ios");
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("android");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setMode("hidden");
    setShowIosSteps(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // nada
    }
  }

  async function install() {
    if (mode === "ios") {
      setShowIosSteps(true);
      return;
    }
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setMode("hidden");
    setDeferred(null);
  }

  if (mode === "hidden") return null;

  return (
    <>
      <div className="sand-surface flex items-center gap-3 rounded-2xl p-3 md:hidden">
        <AppIcon />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm font-extrabold text-plum-900">Tené Turnia en tu celular</p>
          <p className="text-xs text-plum-600">Entrá con un toque, como una app</p>
        </div>
        <button onClick={install} className="btn bg-plum-900 text-white px-4 py-2 text-xs">
          Instalar
        </button>
        <button onClick={dismiss} aria-label="Cerrar aviso" className="p-1 text-plum-400">
          <IconX className="h-4 w-4" />
        </button>
      </div>

      {showIosSteps && (
        <div className="fixed inset-0 z-50 flex items-end bg-plum-900/50" onClick={() => setShowIosSteps(false)}>
          <div
            className="relative m-2 mb-24 w-full rounded-3xl bg-white p-5 space-y-4"
            role="dialog"
            aria-label="Cómo instalar Turnia"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <AppIcon />
              <div>
                <p className="font-extrabold text-plum-900">Instalá Turnia</p>
                <p className="text-xs text-plum-500">En iPhone son dos toques</p>
              </div>
            </div>
            <ol className="space-y-2.5 text-sm text-plum-900">
              <li className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-plum-50 text-xs font-extrabold">1</span>
                Tocá <IconShare className="h-5 w-5 text-blue-600" /> <b>Compartir</b> en la barra de Safari
              </li>
              <li className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-plum-50 text-xs font-extrabold">2</span>
                Elegí <IconPlusBox className="h-5 w-5" /> <b>Agregar a inicio</b>
              </li>
            </ol>
            <button onClick={dismiss} className="btn w-full bg-plum-900 text-white">
              Entendido
            </button>
            <Sketch name="arrow" className="absolute left-1/2 -bottom-16 h-14 w-14 text-white" />
          </div>
        </div>
      )}
    </>
  );
}

function AppIcon() {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-plum-900 text-lg font-extrabold text-white">
      <span>
        t<span className="text-brand-300">.</span>
      </span>
    </span>
  );
}

import { useEffect, useState } from "react";
import { X, Share } from "lucide-react";

const STORAGE_KEY = "pwa-install-dismissed";

type Platform = "android" | "ios" | null;

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return null;
}

function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || !!(navigator as any).standalone;
}

export function PwaInstallBanner() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (isInstalled()) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const p = detectPlatform();
    setPlatform(p);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler as any);

    if (p === "ios") {
      const timer = setTimeout(() => setShow(true), 1500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handler as any);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler as any);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
    setDeferredPrompt(null);
  }

  if (!show) return null;

  return (
    <div className="mt-6 rounded-3xl border border-border/60 bg-card shadow-soft">
      <div className="flex items-center gap-4 p-6">
        <img src="/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-xl" />

        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {platform === "ios"
              ? "Installer Protocole Clear sur ton iPhone"
              : "Installer Protocole Clear sur ton Android"}
          </p>
          {platform === "ios" ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Appuie sur <Share className="inline-block h-4 w-4 align-middle" /> puis{" "}
              <strong className="text-foreground">« Sur l'écran d'accueil »</strong>
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Accès rapide, mode hors-ligne, expérience native
            </p>
          )}
        </div>

        {platform !== "ios" && (
          <button
            onClick={install}
            className="shrink-0 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Installer
          </button>
        )}

        <button
          onClick={dismiss}
          aria-label="Fermer"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

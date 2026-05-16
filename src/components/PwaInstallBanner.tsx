import { useEffect, useState } from "react";
import { X, Share, Plus } from "lucide-react";

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

    // Android / Chrome: listen for native install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler as any);

    // iOS Safari: show manual instructions after a short delay
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
    <div className="fixed bottom-20 left-4 right-4 z-50 sm:left-auto sm:right-6 sm:w-80">
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-elegant">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/icon-192.png" alt="Protocole Clear" className="h-10 w-10 rounded-xl" />
            <div>
              <p className="text-sm font-semibold">Protocole Clear</p>
              <p className="text-xs text-muted-foreground">Ajouter à l'écran d'accueil</p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {platform === "ios" ? (
          <div className="mt-3 space-y-1.5 rounded-xl bg-muted/50 px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Pour l'installer :</p>
            <div className="flex items-center gap-2 text-xs font-medium">
              <Share className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Appuie sur <strong>Partager</strong></span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium">
              <Plus className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Puis <strong>« Sur l'écran d'accueil »</strong></span>
            </div>
          </div>
        ) : (
          <button
            onClick={install}
            className="mt-3 w-full rounded-xl bg-foreground py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Installer l'app
          </button>
        )}
      </div>
    </div>
  );
}

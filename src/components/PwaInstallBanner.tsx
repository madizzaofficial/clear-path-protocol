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
    <div className="fixed left-0 right-0 top-16 z-[39] border-b border-border/60 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <img src="/icon-192.png" alt="" className="h-8 w-8 shrink-0 rounded-xl" />

        <p className="min-w-0 flex-1 truncate text-sm">
          {platform === "ios" ? (
            <>
              Appuie sur{" "}
              <span className="inline-flex items-center gap-1 font-medium">
                <Share className="inline h-3.5 w-3.5" /> Partager
              </span>
              {" "}puis <strong>« Sur l'écran d'accueil »</strong>
            </>
          ) : (
            <>Ajouter <strong>Protocole Clear</strong> à l'écran d'accueil</>
          )}
        </p>

        {platform !== "ios" && (
          <button
            onClick={install}
            className="shrink-0 rounded-xl bg-foreground px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90"
          >
            Installer
          </button>
        )}

        <button
          onClick={dismiss}
          aria-label="Fermer"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

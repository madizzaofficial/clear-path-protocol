import { useRef, useState, useEffect } from "react";
import { Loader2, X } from "lucide-react";

export function LiveBarcodeScanner({
  onDetect,
  onClose,
}: {
  onDetect: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"starting" | "scanning" | "denied">("starting");
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();

      const devices = await BrowserMultiFormatReader.listVideoInputDevices().catch(() => []);
      const backDevice = devices.find((d) => /back|rear|environment/i.test(d.label));
      const deviceId = backDevice?.deviceId ?? devices[devices.length - 1]?.deviceId;

      if (cancelled) return;

      const videoConstraints: MediaTrackConstraints = deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: { ideal: "environment" } };
      (videoConstraints as any).advanced = [{ focusMode: "continuous" }];

      const callback = (result: any) => {
        if (!cancelled && result) onDetect(result.getText());
      };

      let controls: { stop: () => void } | null = null;
      try {
        controls = await reader.decodeFromConstraints({ video: videoConstraints }, videoRef.current!, callback);
      } catch {
        try {
          controls = await reader.decodeFromVideoDevice(deviceId ?? undefined, videoRef.current!, callback);
        } catch {
          if (!cancelled) setStatus("denied");
          return;
        }
      }

      if (cancelled) { controls?.stop(); return; }
      controlsRef.current = controls;
      setStatus("scanning");

      const video = videoRef.current;
      if (video?.srcObject) {
        const track = (video.srcObject as MediaStream).getVideoTracks()[0];
        if (track) {
          track.applyConstraints({ advanced: [{ focusMode: "continuous" } as any] }).catch(() => {});
        }
      }
    }

    start().catch(() => { if (!cancelled) setStatus("denied"); });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [onDetect]);

  if (status === "denied") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-muted/40 px-6 py-8 text-center">
        <p className="text-sm font-medium">Accès caméra refusé</p>
        <p className="text-xs text-muted-foreground">Autorise la caméra dans les paramètres de ton navigateur.</p>
        <button onClick={onClose} className="mt-1 text-xs text-muted-foreground underline underline-offset-2">
          Entrer le code manuellement
        </button>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: "4/3", maxHeight: 260 }}>
      <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />

      {status === "starting" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 className="h-7 w-7 animate-spin text-white" />
        </div>
      )}

      {status === "scanning" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-20 w-56 rounded-xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
      )}

      <button
        onClick={onClose}
        className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
      >
        <X className="h-4 w-4" />
      </button>

      <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/70">
        Pointe vers le code-barres du produit
      </p>
    </div>
  );
}

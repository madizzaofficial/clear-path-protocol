// ─── Questionnaire shared UI components ─────────────────────────────────────────
// Reusable building blocks for the 14-section onboarding questionnaire.

import { useState, type ReactNode } from "react";
import { HelpCircle, X, Upload, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ─── Section ──────────────────────────────────────────────────────────────────────

export function Section({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-soft">
      <h2 className="mb-1 font-display text-lg font-semibold">{title}</h2>
      {intro && <p className="mb-5 text-sm text-muted-foreground leading-relaxed">{intro}</p>}
      <div className="flex flex-col gap-5">{children}</div>
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────────

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Pills (single-select) ─────────────────────────────────────────────────────

export function Pills({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
            value === o.value
              ? "bg-foreground text-background"
              : "border border-border bg-card text-foreground hover:bg-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── MultiPills (multi-select) ──────────────────────────────────────────────────

export function MultiPills({
  options,
  values,
  onChange,
}: {
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(v: string) {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => toggle(o.value)}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
            values.includes(o.value)
              ? "bg-foreground text-background"
              : "border border-border bg-card text-foreground hover:bg-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Scale (1-10) ──────────────────────────────────────────────────────────────

export function Scale({
  value,
  onChange,
  min = 1,
  max = 10,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-all ${
            value === n
              ? "bg-foreground text-background"
              : "border border-border bg-card text-foreground hover:bg-muted"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

// ─── HelpButton ──────────────────────────────────────────────────────────────────

export function HelpButton({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-primary transition-colors"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{title}</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── PhotoUpload ─────────────────────────────────────────────────────────────────

export function PhotoUpload({
  label,
  required,
  value,
  onChange,
  multiple = false,
}: {
  label: string;
  required?: boolean;
  value: string | string[];
  onChange: (v: string | string[]) => void;
  multiple?: boolean;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter(
      (f) => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024,
    );
    if (files.length === 0) return;
    setUploading(true);
    try {
      const { getDownloadURL } = await import("firebase/storage");
      const { ref, uploadBytes } = await import("firebase/storage");
      const { storage } = await import("@/lib/firebase");
      // We need the user's uid — get from auth
      const { auth } = await import("@/lib/firebase");
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      if (multiple) {
        const urls: string[] = Array.isArray(value) ? [...value] : [];
        for (const f of files.slice(0, 3 - urls.length)) {
          const storageRef = ref(storage, `intake_photos/${uid}/${Date.now()}_${f.name}`);
          await uploadBytes(storageRef, f);
          urls.push(await getDownloadURL(storageRef));
        }
        onChange(urls);
      } else {
        const f = files[0];
        const storageRef = ref(storage, `intake_photos/${uid}/${Date.now()}_${f.name}`);
        await uploadBytes(storageRef, f);
        onChange(await getDownloadURL(storageRef));
      }
    } catch (err) {
      console.error("[PhotoUpload] upload error:", err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const preview = multiple
    ? Array.isArray(value)
      ? value
      : []
    : typeof value === "string" && value
      ? [value]
      : [];

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      <div className="flex flex-wrap gap-3">
        {preview.map((url, i) => (
          <div
            key={i}
            className="relative h-24 w-24 overflow-hidden rounded-xl border border-border"
          >
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => {
                if (multiple) onChange((preview as string[]).filter((_, j) => j !== i));
                else onChange("");
              }}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {uploading && (
          <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        {(!multiple && preview.length === 0) || (multiple && preview.length < 3) ? (
          <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 hover:bg-muted transition-colors">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </label>
        ) : null}
      </div>
    </div>
  );
}

// ─── StepperNav ──────────────────────────────────────────────────────────────────

export function StepperNav({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
        <div
          key={step}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            step <= current ? "bg-primary" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

// ─── QuestionnaireShell ─────────────────────────────────────────────────────────

export function QuestionnaireShell({
  step,
  totalSteps,
  title,
  intro,
  children,
}: {
  step: number;
  totalSteps: number;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-6 pb-24 pt-8 md:pt-12">
      <StepperNav current={step} total={totalSteps} />
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.2em] text-primary">
        Étape {step} sur {totalSteps}
      </p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">{title}</h1>
      {intro && <p className="mt-2 text-muted-foreground">{intro}</p>}
      <div className="mt-8 flex flex-col gap-6">{children}</div>
    </div>
  );
}

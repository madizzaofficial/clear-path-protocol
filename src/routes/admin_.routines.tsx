import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { inngest } from "@/lib/inngest";
import { collection, doc, getDocs, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState, useMemo } from "react";
import type { CatalogProduct } from "./admin_.products";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Loader2,
  Check,
  Send,
  Save,
  Sun,
  Moon,
  Users,
  ChevronRight,
  Upload,
  X,
  Package,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserDoc = {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
};

type RoutineStep = {
  id: string;
  order: number;
  category: string;
  product: string;
  instructions: string;
  imageUrl?: string;
  purchaseUrl?: string;
};

type StudentRoutine = {
  uid: string;
  am: RoutineStep[];
  pm: RoutineStep[];
  updatedAt: number;
  sentAt: number | null;
  status: "draft" | "sent";
};

type SendEmailPayload = {
  email: string;
  displayName: string | null;
  am: RoutineStep[];
  pm: RoutineStep[];
};

import { CATEGORIES } from "@/lib/skincare-categories";

// ─── Server function ──────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePayload(data: unknown): SendEmailPayload {
  if (!data || typeof data !== "object") throw new Error("Payload invalide.");
  const d = data as Record<string, unknown>;

  if (typeof d.email !== "string" || !EMAIL_RE.test(d.email))
    throw new Error("Adresse email invalide.");
  if (d.displayName !== null && typeof d.displayName !== "string")
    throw new Error("displayName invalide.");
  if (!Array.isArray(d.am) || !Array.isArray(d.pm))
    throw new Error("Structure de routine invalide.");
  if (d.am.length > 20 || d.pm.length > 20)
    throw new Error("Trop d'étapes dans la routine (max 20).");

  for (const step of [...d.am, ...d.pm]) {
    if (typeof step !== "object" || step === null) throw new Error("Étape invalide.");
    const s = step as Record<string, unknown>;
    if (typeof s.category !== "string" || s.category.length > 100) throw new Error("Catégorie invalide.");
    if (typeof s.product !== "string" || s.product.length > 200) throw new Error("Nom produit trop long.");
    if (s.instructions !== undefined && (typeof s.instructions !== "string" || s.instructions.length > 1000))
      throw new Error("Instructions trop longues.");
  }

  return d as unknown as SendEmailPayload;
}

const sendRoutineEmailFn = createServerFn({ method: "POST" })
  .inputValidator((d: SendEmailPayload) => d)
  .handler(async (ctx) => {
    const data = validatePayload(ctx.data);
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY non configurée.");

    const firstName = data.displayName?.split(" ")[0] ?? "là";
    const html = buildEmailHtml(firstName, data.am, data.pm);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "Protocole Clear <onboarding@resend.dev>",
        to: data.email,
        subject: `${firstName}, ta routine personnalisée est prête ✨`,
        html,
      }),
    });

    if (!res.ok) {
      const err: any = await res.json().catch(() => ({}));
      throw new Error(err.message ?? "Erreur lors de l'envoi de l'email.");
    }

    return { success: true };
  }
);

const triggerRoutineEventFn = createServerFn({ method: "POST" })
  .inputValidator((d: { uid: string; email: string; firstName: string }) => d)
  .handler(async (ctx) => {
    await inngest.send({ name: "routine/assigned", data: ctx.data });
  });

import { uploadProductImageFn } from "@/lib/upload-image";

// ─── Email HTML builder ───────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildEmailHtml(
  firstName: string,
  am: RoutineStep[],
  pm: RoutineStep[]
): string {
  const stepBlock = (steps: RoutineStep[]) =>
    steps.length === 0
      ? `<p style="color:#999;font-size:14px;font-style:italic;margin:0;">Aucune étape configurée.</p>`
      : steps
          .map(
            (s, i) => `
<div style="display:flex;gap:14px;padding:14px 0;${i < steps.length - 1 ? "border-bottom:1px solid #f0ebe4;" : ""}">
  <div style="min-width:28px;height:28px;background:#f7f0ec;border-radius:50%;text-align:center;line-height:28px;flex-shrink:0;">
    <span style="color:#c4724b;font-size:13px;font-weight:700;">${i + 1}</span>
  </div>
  <div>
    <span style="display:inline-block;background:#fff3ec;color:#c4724b;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;padding:2px 10px;border-radius:100px;margin-bottom:6px;">${escapeHtml(s.category)}</span>
    <p style="color:#1a1a1a;font-weight:600;margin:0 0 3px;font-size:14px;">${escapeHtml(s.product)}</p>
    <p style="color:#888;margin:0;font-size:13px;line-height:1.55;">${escapeHtml(s.instructions)}</p>
  </div>
</div>`
          )
          .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Ta routine Protocole Clear</title>
</head>
<body style="margin:0;padding:0;background:#fdf8f3;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 20px;">

  <!-- Logo -->
  <div style="text-align:center;margin-bottom:32px;">
    <img src="https://app.protocole-clear.com/logo_clear.png" alt="Protocole Clear" width="56" height="56" style="border-radius:50%;display:block;margin:0 auto 12px;border:0;" />
    <h1 style="font-family:Georgia,serif;color:#1a1a1a;margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em;">Protocole Clear</h1>
    <p style="color:#aaa;font-size:12px;margin:4px 0 0;letter-spacing:0.12em;text-transform:uppercase;">Clear Skin Protocol</p>
  </div>

  <!-- Greeting -->
  <div style="background:white;border-radius:24px;padding:28px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
    <h2 style="font-family:Georgia,serif;color:#1a1a1a;margin:0 0 10px;font-size:22px;">Bonjour ${firstName} !</h2>
    <p style="color:#555;margin:0;line-height:1.65;font-size:15px;">
      Ta routine personnalisée est prête. Elle a été élaborée spécialement pour ta peau. Applique-la chaque jour pour des résultats visibles.
      </br> </br>Tu peux la consulter sur ton espace personnel via le menu "Routine".
    </p>
  </div>

  <!-- AM -->
  <div style="background:white;border-radius:24px;padding:24px 28px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
    <table cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
      <tr>
        <td style="padding-right:14px;">
          <div style="background:#fff3ec;border-radius:14px;padding:8px 14px;font-size:20px;line-height:1;">☀️</div>
        </td>
        <td>
          <h3 style="font-family:Georgia,serif;color:#1a1a1a;margin:0;font-size:17px;">Routine du matin</h3>
          <p style="color:#bbb;font-size:12px;margin:2px 0 0;text-transform:uppercase;letter-spacing:0.07em;">${am.length} étape${am.length !== 1 ? "s" : ""}</p>
        </td>
      </tr>
    </table>
    ${stepBlock(am)}
  </div>

  <!-- PM -->
  <div style="background:white;border-radius:24px;padding:24px 28px;margin-bottom:28px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
    <table cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
      <tr>
        <td style="padding-right:14px;">
          <div style="background:#f0edf8;border-radius:14px;padding:8px 14px;font-size:20px;line-height:1;">🌙</div>
        </td>
        <td>
          <h3 style="font-family:Georgia,serif;color:#1a1a1a;margin:0;font-size:17px;">Routine du soir</h3>
          <p style="color:#bbb;font-size:12px;margin:2px 0 0;text-transform:uppercase;letter-spacing:0.07em;">${pm.length} étape${pm.length !== 1 ? "s" : ""}</p>
        </td>
      </tr>
    </table>
    ${stepBlock(pm)}
  </div>

  <!-- Footer -->
  <p style="text-align:center;color:#ccc;font-size:12px;line-height:1.6;margin:0;">
    Cet email a été envoyé via <strong style="color:#c4724b;">Protocole Clear</strong> · Clear Skin Protocol.<br>
    Des questions ? Réponds directement à cet email.
  </p>

</div>
</body>
</html>`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin_/routines")({
  validateSearch: (search: Record<string, unknown>) => ({
    uid: typeof search.uid === "string" ? search.uid : "",
  }),
  head: () => ({
    meta: [{ title: "Routines des élèves — Protocole Clear" }],
  }),
  component: RoutinesPage,
});

// ─── Guard wrapper ────────────────────────────────────────────────────────────

function RoutinesPage() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
    if (!loading && user && !isAdmin) navigate({ to: "/admin" });
  }, [user, loading, isAdmin, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) return null;

  return <RoutinesContent />;
}

// ─── Main content ─────────────────────────────────────────────────────────────

function RoutinesContent() {
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDoc | null>(null);
  const [routine, setRoutine] = useState<StudentRoutine | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRoutine, setLoadingRoutine] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<"success" | "error" | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"am" | "pm">("am");

  const [editingStep, setEditingStep] = useState<RoutineStep | null>(null);
  const [isNewStep, setIsNewStep] = useState(false);
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null);

  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [savingToCatalog, setSavingToCatalog] = useState(false);

  const { uid: preselectedUid } = Route.useSearch();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    async function loadUsers() {
      setLoadingUsers(true);
      try {
        const [usersSnap, catalogSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "admin_products")),
        ]);
        const fetched = usersSnap.docs.map((d) => d.data() as UserDoc);
        setUsers(fetched);
        setCatalogProducts(catalogSnap.docs.map((d) => d.data() as CatalogProduct));

        // Auto-select if uid was passed via search param
        if (preselectedUid) {
          const match = fetched.find((u) => u.uid === preselectedUid);
          if (match) selectUser(match);
        }
      } finally {
        setLoadingUsers(false);
      }
    }
    loadUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedUid]);

  async function selectUser(u: UserDoc) {
    setSelectedUser(u);
    setRoutine(null);
    setActiveTab("am");
    setSendResult(null);
    setLoadingRoutine(true);
    try {
      const snap = await getDoc(doc(db, "routines", u.uid));
      setRoutine(
        snap.exists()
          ? (snap.data() as StudentRoutine)
          : { uid: u.uid, am: [], pm: [], updatedAt: Date.now(), sentAt: null, status: "draft" }
      );
    } finally {
      setLoadingRoutine(false);
    }
  }

  async function saveRoutine(updated: StudentRoutine) {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const clean = JSON.parse(JSON.stringify(updated)) as StudentRoutine;
      await setDoc(doc(db, "routines", selectedUser.uid), clean);
      setRoutine(updated);
    } finally {
      setSaving(false);
    }
  }

  async function handleSendEmail() {
    if (!routine || !selectedUser) return;
    setSending(true);
    setSendResult(null);
    setSendError(null);
    try {
      const toSave: StudentRoutine = {
        ...routine,
        status: "sent",
        sentAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Save to Firestore first — always succeeds regardless of email
      await setDoc(doc(db, "routines", selectedUser.uid), toSave);
      setRoutine(toSave);

      // Email + Inngest event — failure here doesn't roll back the save
      await sendRoutineEmailFn({
        data: {
          email: selectedUser.email,
          displayName: selectedUser.displayName,
          am: routine.am,
          pm: routine.pm,
        },
      });

      triggerRoutineEventFn({
        data: {
          uid: selectedUser.uid,
          email: selectedUser.email,
          firstName: selectedUser.displayName?.split(" ")[0] ?? selectedUser.email.split("@")[0],
        },
      }).catch(() => {});

      setSendResult("success");
    } catch (e: any) {
      console.error("[routines] send email error:", e);
      setSendError(e?.message ?? "Erreur inconnue");
      setSendResult("error");
    } finally {
      setSending(false);
    }
  }

  function handleStepDragEnd(tab: "am" | "pm", event: DragEndEvent) {
    if (!routine) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const steps = tab === "am" ? routine.am : routine.pm;
    const from = steps.findIndex((s) => s.id === active.id);
    const to = steps.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(steps, from, to).map((s, i) => ({ ...s, order: i }));
    const updated = { ...routine, [tab]: reordered, updatedAt: Date.now() };
    setRoutine(updated);
    saveRoutine(updated);
  }

  function handleSaveStep(data: { category: string; product: string; instructions: string; imageUrl?: string; purchaseUrl?: string }) {
    if (!routine) return;
    const steps = activeTab === "am" ? routine.am : routine.pm;
    let updated: StudentRoutine;
    if (isNewStep) {
      const newStep: RoutineStep = {
        id: `s-${Date.now()}`,
        order: steps.length,
        ...data,
      };
      updated = { ...routine, [activeTab]: [...steps, newStep], updatedAt: Date.now() };
    } else if (editingStep) {
      updated = {
        ...routine,
        [activeTab]: steps.map((s) => (s.id === editingStep.id ? { ...s, ...data } : s)),
        updatedAt: Date.now(),
      };
    } else return;
    setRoutine(updated);
    setEditingStep(null);
    saveRoutine(updated);
  }

  async function handleSaveToCatalog(data: { category: string; product: string; instructions: string; imageUrl?: string; purchaseUrl?: string }) {
    setSavingToCatalog(true);
    try {
      const existing = catalogProducts.find(
        (p) => p.name.toLowerCase() === data.product.trim().toLowerCase() && p.category === data.category
      );
      const id = existing?.id ?? crypto.randomUUID();
      const entry: CatalogProduct = {
        id,
        name: data.product.trim(),
        category: data.category,
        instructions: data.instructions,
        imageUrl: data.imageUrl,
        purchaseUrl: data.purchaseUrl,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, "admin_products", id), entry);
      setCatalogProducts((prev) =>
        existing ? prev.map((p) => (p.id === id ? entry : p)) : [...prev, entry]
      );
    } finally {
      setSavingToCatalog(false);
    }
  }

  function handleDeleteStep() {
    if (!routine || !deletingStepId) return;
    const steps = (activeTab === "am" ? routine.am : routine.pm)
      .filter((s) => s.id !== deletingStepId)
      .map((s, i) => ({ ...s, order: i }));
    saveRoutine({ ...routine, [activeTab]: steps, updatedAt: Date.now() });
    setDeletingStepId(null);
  }

  const currentSteps = routine ? (activeTab === "am" ? routine.am : routine.pm) : [];

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:pt-12">
        {/* Header */}
        <header className="mb-8">
          <div className="mb-6">
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Retour au dashboard
            </Link>
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Admin</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
              Routines des élèves
            </h1>
            <p className="mt-2 text-muted-foreground">
              Personnalisez la routine de chaque élève et envoyez-la par email.
            </p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[300px,1fr]">
          {/* Student list */}
          <aside className="h-fit rounded-3xl border border-border/60 bg-card shadow-soft">
            <div className="flex items-center gap-3 border-b border-border/60 p-5">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="font-display text-base font-semibold">Élèves</h2>
              {!loadingUsers && (
                <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                  {users.length}
                </span>
              )}
            </div>

            {loadingUsers ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : users.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-muted-foreground">Aucun élève inscrit.</p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Les élèves apparaîtront ici après leur inscription.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/40 p-2">
                {users.map((u) => {
                  const isSelected = selectedUser?.uid === u.uid;
                  const initials = (u.displayName ?? u.email).slice(0, 2).toUpperCase();
                  return (
                    <li key={u.uid}>
                      <button
                        onClick={() => selectUser(u)}
                        className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${
                          isSelected ? "bg-primary-soft" : "hover:bg-muted/60"
                        }`}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-warm text-sm font-semibold">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {u.displayName ?? "—"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform ${
                            isSelected ? "rotate-90 text-primary" : ""
                          }`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          {/* Routine editor */}
          {!selectedUser ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-border bg-card">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium">Sélectionnez un élève</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  pour éditer sa routine personnalisée
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Student header card */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border/60 bg-card p-5 shadow-soft md:p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-warm text-base font-semibold">
                    {(selectedUser.displayName ?? selectedUser.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-semibold">
                      {selectedUser.displayName ?? "—"}
                    </h2>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {routine?.status === "sent" && routine.sentAt && (
                    <span className="flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-medium">
                      <Check className="h-3 w-3 text-primary" />
                      Envoyée le {new Date(routine.sentAt).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                  {routine?.status !== "sent" && (
                    <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      Brouillon
                    </span>
                  )}
                  {saving && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Sauvegarde…
                    </span>
                  )}
                </div>
              </div>

              {loadingRoutine ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* AM / PM tabs */}
                  <div className="flex gap-2 rounded-2xl bg-muted p-1.5">
                    {(["am", "pm"] as const).map((tab) => {
                      const count = routine ? (tab === "am" ? routine.am.length : routine.pm.length) : 0;
                      const isActive = activeTab === tab;
                      return (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all ${
                            isActive
                              ? "bg-card shadow-soft text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {tab === "am" ? (
                            <Sun className="h-4 w-4" />
                          ) : (
                            <Moon className="h-4 w-4" />
                          )}
                          {tab === "am" ? "Matin" : "Soir"}
                          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Steps list */}
                  <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
                    {currentSteps.length === 0 ? (
                      <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                        Aucune étape — ajoutez la première ci-dessous.
                      </p>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(e) => handleStepDragEnd(activeTab, e)}
                      >
                        <SortableContext
                          items={currentSteps.map((s) => s.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <ul className="divide-y divide-border/40">
                            {currentSteps.map((step, idx) => (
                              <SortableStep
                                key={step.id}
                                step={step}
                                idx={idx}
                                onEdit={() => {
                                  setEditingStep(step);
                                  setIsNewStep(false);
                                }}
                                onDelete={() => setDeletingStepId(step.id)}
                              />
                            ))}
                          </ul>
                        </SortableContext>
                      </DndContext>
                    )}

                    <div
                      className={`p-4 ${currentSteps.length > 0 ? "border-t border-border/40" : ""}`}
                    >
                      <button
                        onClick={() => {
                          setEditingStep({
                            id: "",
                            order: currentSteps.length,
                            category: CATEGORIES[0],
                            product: "",
                            instructions: "",
                          });
                          setIsNewStep(true);
                        }}
                        className="flex items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft/30 hover:text-foreground"
                      >
                        <Plus className="h-4 w-4" /> Ajouter une étape
                      </button>
                    </div>
                  </div>

                  {/* Send result feedback */}
                  <AnimatePresence>
                    {sendResult === "success" && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-medium"
                      >
                        <Check className="h-4 w-4 text-primary" />
                        Email envoyé à {selectedUser.email} !
                      </motion.div>
                    )}
                    {sendResult === "error" && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
                      >
                        Échec de l'envoi — {sendError ?? "vérifiez la configuration Resend et le domaine expéditeur."}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <button
                      onClick={() =>
                        routine &&
                        saveRoutine({ ...routine, updatedAt: Date.now() })
                      }
                      disabled={saving || !routine}
                      className="flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Sauvegarder
                    </button>
                    <button
                      onClick={handleSendEmail}
                      disabled={
                        sending ||
                        (routine?.am.length === 0 && routine?.pm.length === 0)
                      }
                      className="flex items-center gap-2 rounded-2xl bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Envoi en cours…
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Envoyer à{" "}
                          {selectedUser.displayName?.split(" ")[0] ?? selectedUser.email}
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Dialogs */}
      <StepDialog
        step={editingStep}
        isNew={isNewStep}
        onClose={() => setEditingStep(null)}
        onSave={handleSaveStep}
        saving={saving}
        catalogProducts={catalogProducts}
        onSaveToCatalog={handleSaveToCatalog}
        savingToCatalog={savingToCatalog}
      />

      <AlertDialog
        open={!!deletingStepId}
        onOpenChange={(o) => !o && setDeletingStepId(null)}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Supprimer cette étape ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette étape sera définitivement supprimée de la routine.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStep}
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

// ─── Sortable Step ────────────────────────────────────────────────────────────

function SortableStep({
  step,
  idx,
  onEdit,
  onDelete,
}: {
  step: RoutineStep;
  idx: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 px-5 py-4 md:px-6"
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 cursor-grab text-muted-foreground/30 transition-colors hover:text-muted-foreground/60 active:cursor-grabbing"
        title="Réorganiser"
      >
        <GripVertical className="h-4 w-4 shrink-0" />
      </button>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
        {idx + 1}
      </span>
      <div className="min-w-0 flex-1">
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {step.category}
        </span>
        <p className="mt-1 text-sm font-semibold">
          {step.product || <span className="text-muted-foreground italic">—</span>}
        </p>
        {step.instructions && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {step.instructions}
          </p>
        )}
      </div>
      {step.imageUrl && (
        <img
          src={step.imageUrl}
          alt={step.product}
          className="h-12 w-12 shrink-0 rounded-xl border border-border object-cover"
        />
      )}
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={onEdit}
          title="Modifier"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          title="Supprimer"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

// ─── Step Dialog ──────────────────────────────────────────────────────────────

function StepDialog({
  step,
  isNew,
  onClose,
  onSave,
  saving,
  catalogProducts,
  onSaveToCatalog,
  savingToCatalog,
}: {
  step: RoutineStep | null;
  isNew: boolean;
  onClose: () => void;
  onSave: (d: { category: string; product: string; instructions: string; imageUrl?: string; purchaseUrl?: string }) => void;
  saving: boolean;
  catalogProducts: CatalogProduct[];
  onSaveToCatalog: (data: { category: string; product: string; instructions: string; imageUrl?: string; purchaseUrl?: string }) => Promise<void>;
  savingToCatalog: boolean;
}) {
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [product, setProduct] = useState("");
  const [instructions, setInstructions] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [purchaseUrl, setPurchaseUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);

  const catalogResults = useMemo(() => {
    if (!catalogSearch.trim()) return catalogProducts.slice(0, 8);
    const q = catalogSearch.toLowerCase();
    return catalogProducts
      .filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      .slice(0, 20);
  }, [catalogProducts, catalogSearch]);

  useEffect(() => {
    if (step) {
      setCategory(step.category || CATEGORIES[0]);
      setProduct(step.product);
      setInstructions(step.instructions);
      setImageUrl(step.imageUrl ?? "");
      setPurchaseUrl(step.purchaseUrl ?? "");
      setUploadError(null);
      setUploading(false);
      setShowCatalogPicker(false);
      setCatalogSearch("");
    }
  }, [step]);

  function fillFromCatalog(p: CatalogProduct) {
    setCategory(p.category);
    setProduct(p.name);
    setInstructions(p.instructions);
    setImageUrl(p.imageUrl ?? "");
    setPurchaseUrl(p.purchaseUrl ?? "");
    setCatalogSearch("");
    setShowCatalogPicker(false);
  }

  async function handleImageFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(new Error("File read error"));
        reader.readAsDataURL(file);
      });
      const { publicUrl } = await uploadProductImageFn({
        data: { fileName: file.name, contentType: file.type || "image/jpeg", base64 },
      });
      setImageUrl(publicUrl);
    } catch (err: any) {
      console.error("[uploadProductImage] client error:", err);
      setUploadError(err?.message ?? "Erreur lors de l'upload — réessaye.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={!!step} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col rounded-3xl sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-display text-xl">
            {isNew ? "Ajouter une étape" : "Modifier l'étape"}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 py-2">
          {/* Catalog picker */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-foreground/80">Depuis le catalogue</label>
              <button
                type="button"
                onClick={() => setShowCatalogPicker((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <Package className="h-3 w-3" />
                {showCatalogPicker ? "Fermer" : "Choisir un produit"}
              </button>
            </div>
            {showCatalogPicker && (
              <div className="rounded-2xl border border-border bg-muted/40 p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Rechercher dans le catalogue…"
                    className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary"
                  />
                </div>
                <ul className="mt-2 max-h-44 overflow-y-auto space-y-0.5">
                  {catalogResults.length === 0 ? (
                    <li className="py-3 text-center text-xs text-muted-foreground">Aucun résultat</li>
                  ) : (
                    catalogResults.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => fillFromCatalog(p)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-background"
                        >
                          {p.imageUrl ? (
                            <img src={p.imageUrl} className="h-8 w-8 shrink-0 rounded-lg object-contain border border-border" />
                          ) : (
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                              <Package className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.category}</p>
                          </div>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">Catégorie</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">Produit</label>
            <input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="ex. CeraVe Hydrating Cleanser"
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">Instructions</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="ex. Appliquer sur peau humide, masser doucement 30 s puis rincer."
              rows={3}
              className="w-full resize-none rounded-2xl border border-border bg-background p-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">
              Image du produit <span className="font-normal text-muted-foreground">(optionnelle)</span>
            </label>
            {imageUrl ? (
              <div className="relative inline-block">
                <img
                  src={imageUrl}
                  alt="Aperçu produit"
                  className="h-24 w-24 rounded-2xl border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : uploading ? (
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Upload en cours…</span>
              </div>
            ) : (
              <>
                <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft/30 hover:text-foreground">
                  <Upload className="h-4 w-4 shrink-0" />
                  Choisir une image
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageFile(file);
                    }}
                  />
                </label>
                {uploadError && (
                  <p className="mt-1.5 text-xs text-destructive">{uploadError}</p>
                )}
              </>
            )}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">
              Lien d'achat <span className="font-normal text-muted-foreground">(URL optionnelle)</span>
            </label>
            <input
              value={purchaseUrl}
              onChange={(e) => setPurchaseUrl(e.target.value)}
              placeholder="https://..."
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        </div>
        <DialogFooter className="shrink-0 gap-2 sm:gap-2">
          <button
            type="button"
            onClick={() => onSaveToCatalog({ category, product, instructions, imageUrl: imageUrl.trim() || undefined, purchaseUrl: purchaseUrl.trim() || undefined })}
            disabled={savingToCatalog || !product.trim()}
            className="mr-auto flex items-center gap-2 rounded-2xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            {savingToCatalog ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            Catalogue
          </button>
          <button
            onClick={onClose}
            className="rounded-2xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Annuler
          </button>
          <button
            onClick={() => onSave({ category, product, instructions, imageUrl: imageUrl.trim() || undefined, purchaseUrl: purchaseUrl.trim() || undefined })}
            disabled={saving || !product.trim()}
            className="flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isNew ? "Ajouter" : "Sauvegarder"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

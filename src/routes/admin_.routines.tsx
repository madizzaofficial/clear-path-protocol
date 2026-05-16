import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { StudentPicker } from "@/components/StudentPicker";
import { SortableStep, StepDialog } from "@/components/RoutineStepEditor";
import type { RoutineStep, ExtraBlock } from "@/components/RoutineStepEditor";
import { createServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/AdminShell";
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
  arrayMove,
} from "@dnd-kit/sortable";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Check,
  Send,
  Save,
  Sun,
  Moon,
  Zap,
  Pencil,
  Trash2,
  Users,
  LayoutTemplate,
  BookmarkPlus,
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
  photoURL?: string | null;
};

type StudentRoutine = {
  uid: string;
  am: RoutineStep[];
  pm: RoutineStep[];
  extras: ExtraBlock[];
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

type IntakeAnswers = {
  skinType?: string;
  acneTypes?: string[];
  intensity?: string;
  currentRoutine?: string;
  mainGoal?: string;
};

const SKIN_TYPE_LABELS: Record<string, string> = {
  normale: "Normale",
  grasse: "Grasse",
  seche: "Sèche",
  mixte: "Mixte",
  sensible: "Sensible",
};
const ACNE_TYPE_LABELS: Record<string, string> = {
  comedons: "Comédons",
  papules: "Papules / Pustules",
  microkystes: "Microkystes",
  kystes: "Kystes / Nodules",
};
const INTENSITY_LABELS: Record<string, string> = {
  legere: "Légère",
  moderee: "Modérée",
  severe: "Sévère",
};

type RoutineTemplate = {
  id: string;
  name: string;
  description?: string;
  am: RoutineStep[];
  pm: RoutineStep[];
  extras: ExtraBlock[];
  createdAt: number;
  updatedAt: number;
};

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
    if (typeof s.category !== "string" || s.category.length > 100)
      throw new Error("Catégorie invalide.");
    if (typeof s.product !== "string" || s.product.length > 200)
      throw new Error("Nom produit trop long.");
    if (
      s.instructions !== undefined &&
      (typeof s.instructions !== "string" || s.instructions.length > 1000)
    )
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
  });

const triggerRoutineEventFn = createServerFn({ method: "POST" })
  .inputValidator((d: { uid: string; email: string; firstName: string }) => d)
  .handler(async (ctx) => {
    await inngest.send({ name: "routine/assigned", data: ctx.data });
  });



// ─── Email HTML builder ───────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildEmailHtml(firstName: string, am: RoutineStep[], pm: RoutineStep[]): string {
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
</div>`,
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
  const [editingExtrasBlockId, setEditingExtrasBlockId] = useState<string | null>(null);
  const [deletingStepInfo, setDeletingStepInfo] = useState<{ blockId: string; stepId: string } | null>(null);
  const [deletingBlockId, setDeletingBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingBlockName, setEditingBlockName] = useState("");

  const [editingStep, setEditingStep] = useState<RoutineStep | null>(null);
  const [isNewStep, setIsNewStep] = useState(false);
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null);

  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [savingToCatalog, setSavingToCatalog] = useState(false);

  const [routineStatusMap, setRoutineStatusMap] = useState<Map<string, "sent" | "draft">>(
    new Map(),
  );
  const [intake, setIntake] = useState<IntakeAnswers | null>(null);
  const [loadingIntake, setLoadingIntake] = useState(false);

  const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [pendingTemplate, setPendingTemplate] = useState<RoutineTemplate | null>(null);

  const { uid: preselectedUid } = Route.useSearch();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    async function loadUsers() {
      setLoadingUsers(true);
      try {
        const [usersSnap, catalogSnap, routinesSnap, templatesSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "admin_products")),
          getDocs(collection(db, "routines")),
          getDocs(collection(db, "routine_templates")),
        ]);
        const fetched = usersSnap.docs.map((d) => d.data() as UserDoc);
        setUsers(fetched);
        setCatalogProducts(catalogSnap.docs.map((d) => d.data() as CatalogProduct));
        const sMap = new Map<string, "sent" | "draft">();
        routinesSnap.docs.forEach((d) => {
          const s = d.data().status as "sent" | "draft" | undefined;
          if (s) sMap.set(d.id, s);
        });
        setRoutineStatusMap(sMap);
        setTemplates(templatesSnap.docs.map((d) => d.data() as RoutineTemplate));

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
    setIntake(null);
    setActiveTab("am");
    setSendResult(null);
    setLoadingRoutine(true);
    setLoadingIntake(true);
    try {
      const [routineSnap, intakeSnap] = await Promise.all([
        getDoc(doc(db, "routines", u.uid)),
        getDoc(doc(db, "intake_answers", u.uid)),
      ]);
      if (routineSnap.exists()) {
        const data = routineSnap.data() as StudentRoutine;
        setRoutine({ ...data, extras: data.extras ?? [] });
      } else {
        setRoutine({ uid: u.uid, am: [], pm: [], extras: [], updatedAt: Date.now(), sentAt: null, status: "draft" });
      }
      setIntake(intakeSnap.exists() ? (intakeSnap.data() as IntakeAnswers) : null);
    } finally {
      setLoadingRoutine(false);
      setLoadingIntake(false);
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
      await setDoc(doc(db, "routines", selectedUser.uid), JSON.parse(JSON.stringify(toSave)));
      setRoutine(toSave);
      setRoutineStatusMap((prev) => {
        const next = new Map(prev);
        next.set(selectedUser.uid, "sent");
        return next;
      });

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

  function handleSaveStep(data: {
    category: string;
    product: string;
    instructions: string;
    imageUrl?: string;
    purchaseUrl?: string;
  }) {
    if (!routine) return;
    let updated: StudentRoutine;
    if (editingExtrasBlockId !== null) {
      const block = routine.extras.find((b) => b.id === editingExtrasBlockId);
      if (!block) return;
      const newSteps = isNewStep
        ? [...block.steps, { id: `s-${Date.now()}`, order: block.steps.length, ...data }]
        : block.steps.map((s) => (s.id === editingStep?.id ? { ...s, ...data } : s));
      const updatedBlock = { ...block, steps: newSteps };
      updated = { ...routine, extras: routine.extras.map((b) => (b.id === editingExtrasBlockId ? updatedBlock : b)), updatedAt: Date.now() };
    } else {
      const steps = activeTab === "am" ? routine.am : routine.pm;
      if (isNewStep) {
        updated = { ...routine, [activeTab]: [...steps, { id: `s-${Date.now()}`, order: steps.length, ...data }], updatedAt: Date.now() };
      } else if (editingStep) {
        updated = { ...routine, [activeTab]: steps.map((s) => (s.id === editingStep.id ? { ...s, ...data } : s)), updatedAt: Date.now() };
      } else return;
    }
    setRoutine(updated);
    setEditingStep(null);
    setEditingExtrasBlockId(null);
    saveRoutine(updated);
  }

  async function handleSaveToCatalog(data: {
    category: string;
    product: string;
    description?: string;
    instructions: string;
    imageUrl?: string;
    purchaseUrl?: string;
  }) {
    setSavingToCatalog(true);
    try {
      const existing = catalogProducts.find(
        (p) =>
          p.name.toLowerCase() === data.product.trim().toLowerCase() &&
          p.category === data.category,
      );
      const id = existing?.id ?? crypto.randomUUID();
      const entry: CatalogProduct = {
        id,
        name: data.product.trim(),
        category: data.category,
        description: data.description,
        instructions: data.instructions,
        imageUrl: data.imageUrl,
        purchaseUrl: data.purchaseUrl,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, "admin_products", id), entry);
      setCatalogProducts((prev) =>
        existing ? prev.map((p) => (p.id === id ? entry : p)) : [...prev, entry],
      );
    } finally {
      setSavingToCatalog(false);
    }
  }

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) => t.name.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q),
    );
  }, [templates, templateSearch]);

  function applyTemplate(t: RoutineTemplate) {
    if (!routine) return;
    const remapSteps = (steps: RoutineStep[]) =>
      steps.map((s, i) => ({ ...s, id: `s-${Date.now()}-${i}`, order: i }));
    const remapBlocks = (blocks: ExtraBlock[]) =>
      (blocks ?? []).map((b, bi) => ({ ...b, id: `b-${Date.now()}-${bi}`, steps: remapSteps(b.steps) }));
    const updated: StudentRoutine = {
      ...routine,
      am: remapSteps(t.am),
      pm: remapSteps(t.pm),
      extras: remapBlocks(t.extras ?? []),
      status: "draft",
      sentAt: null,
      updatedAt: Date.now(),
    };
    setRoutine(updated);
    saveRoutine(updated);
    setPendingTemplate(null);
    setShowTemplatePicker(false);
  }

  async function saveAsTemplate() {
    if (!routine || !templateName.trim()) return;
    setSavingTemplate(true);
    try {
      const id = crypto.randomUUID();
      const template: RoutineTemplate = {
        id,
        name: templateName.trim(),
        description: templateDesc.trim() || undefined,
        am: routine.am,
        pm: routine.pm,
        extras: routine.extras,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await setDoc(doc(db, "routine_templates", id), template);
      setTemplates((prev) => [...prev, template]);
      setShowSaveTemplate(false);
      setTemplateName("");
      setTemplateDesc("");
    } finally {
      setSavingTemplate(false);
    }
  }

  function handleDeleteStep() {
    if (!routine || !deletingStepId) return;
    const steps = (activeTab === "am" ? routine.am : routine.pm)
      .filter((s) => s.id !== deletingStepId)
      .map((s, i) => ({ ...s, order: i }));
    const updated = { ...routine, [activeTab]: steps, updatedAt: Date.now() };
    setRoutine(updated);
    saveRoutine(updated);
    setDeletingStepId(null);
  }

  function handleDeleteExtrasStep() {
    if (!routine || !deletingStepInfo) return;
    const { blockId, stepId } = deletingStepInfo;
    const block = routine.extras.find((b) => b.id === blockId);
    if (!block) { setDeletingStepInfo(null); return; }
    const steps = block.steps.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, order: i }));
    const updated = { ...routine, extras: routine.extras.map((b) => (b.id === blockId ? { ...b, steps } : b)), updatedAt: Date.now() };
    setRoutine(updated);
    saveRoutine(updated);
    setDeletingStepInfo(null);
  }

  function handleDeleteBlock() {
    if (!routine || !deletingBlockId) return;
    const updated = { ...routine, extras: routine.extras.filter((b) => b.id !== deletingBlockId), updatedAt: Date.now() };
    setRoutine(updated);
    saveRoutine(updated);
    setDeletingBlockId(null);
  }

  function addExtrasBlock() {
    if (!routine) return;
    const newBlock: ExtraBlock = { id: `b-${Date.now()}`, name: "En cas de…", steps: [] };
    const updated = { ...routine, extras: [...routine.extras, newBlock], updatedAt: Date.now() };
    setRoutine(updated);
    saveRoutine(updated);
    setEditingBlockId(newBlock.id);
    setEditingBlockName(newBlock.name);
  }

  function saveBlockName(blockId: string) {
    if (!routine || !editingBlockName.trim()) { setEditingBlockId(null); return; }
    const updated = { ...routine, extras: routine.extras.map((b) => (b.id === blockId ? { ...b, name: editingBlockName.trim() } : b)), updatedAt: Date.now() };
    setRoutine(updated);
    saveRoutine(updated);
    setEditingBlockId(null);
  }

  const currentSteps = routine ? (activeTab === "am" ? routine.am : routine.pm) : [];

  return (
    <AdminShell>
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

        {/* Student picker */}
        <div className="mb-6">
          <StudentPicker
            users={users}
            selected={selectedUser}
            onSelect={selectUser}
            loading={loadingUsers}
            statusMap={routineStatusMap}
          />
        </div>

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
          <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
            <div className="order-2 lg:order-1">
              <SkinProfilePanel intake={intake} loading={loadingIntake} />
            </div>
            <div className="order-1 lg:order-2 space-y-4">
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

              {/* Template actions */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    setTemplateSearch("");
                    setShowTemplatePicker(true);
                  }}
                  disabled={!routine}
                  className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40"
                >
                  <LayoutTemplate className="h-4 w-4" /> Charger un modèle
                </button>
                <button
                  onClick={() => {
                    setTemplateName("");
                    setTemplateDesc("");
                    setShowSaveTemplate(true);
                  }}
                  disabled={!routine || (routine.am.length === 0 && routine.pm.length === 0 && routine.extras.length === 0)}
                  className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40"
                >
                  <BookmarkPlus className="h-4 w-4" /> Sauvegarder comme modèle
                </button>
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
                          {tab === "am" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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

                  {/* ── En cas de (named blocks) ─────────────────────────── */}
                  {routine && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <Zap className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-semibold">En cas de…</span>
                        <span className="text-xs text-muted-foreground">Conseils situationnels — optionnel</span>
                      </div>

                      {routine.extras.map((block) => (
                        <div key={block.id} className="overflow-hidden rounded-3xl border border-yellow-200/60 bg-card shadow-soft dark:border-yellow-900/30">
                          {/* Block header */}
                          <div className="flex items-center gap-2 border-b border-yellow-100/60 bg-yellow-50/40 px-5 py-3 dark:border-yellow-900/20 dark:bg-yellow-950/10">
                            {editingBlockId === block.id ? (
                              <input

                                autoComplete="off"                                autoFocus
                                value={editingBlockName}
                                onChange={(e) => setEditingBlockName(e.target.value)}
                                onBlur={() => saveBlockName(block.id)}
                                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditingBlockId(null); }}
                                className="flex-1 rounded-xl border border-yellow-300/60 bg-white/60 px-3 py-1 text-sm font-semibold outline-none focus:ring-2 focus:ring-yellow-400/30 dark:bg-yellow-900/20"
                              />
                            ) : (
                              <button
                                onClick={() => { setEditingBlockId(block.id); setEditingBlockName(block.name); }}
                                className="flex flex-1 items-center gap-2 text-left"
                              >
                                <span className="text-sm font-semibold">{block.name}</span>
                                <Pencil className="h-3 w-3 text-muted-foreground opacity-60" />
                              </button>
                            )}
                            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400">
                              {block.steps.length}
                            </span>
                            <button
                              onClick={() => setDeletingBlockId(block.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Steps — no DnD to avoid double-context bug */}
                          {block.steps.length > 0 && (
                            <ul className="divide-y divide-border/40">
                              {block.steps.map((step, idx) => (
                                <li key={step.id} className="flex items-center gap-3 px-5 py-3">
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-[10px] font-semibold text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400">
                                    {idx + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium">{step.product}</p>
                                    <p className="text-xs text-muted-foreground">{step.category}</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => { setEditingStep(step); setIsNewStep(false); setEditingExtrasBlockId(block.id); }}
                                      className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setDeletingStepInfo({ blockId: block.id, stepId: step.id })}
                                      className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}

                          {/* Add step */}
                          <div className={`p-4 ${block.steps.length > 0 ? "border-t border-border/40" : ""}`}>
                            <button
                              onClick={() => { setEditingStep({ id: "", order: block.steps.length, category: CATEGORIES[0], product: "", instructions: "" }); setIsNewStep(true); setEditingExtrasBlockId(block.id); }}
                              className="flex items-center gap-2 rounded-2xl border border-dashed border-yellow-300/60 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-yellow-400 hover:bg-yellow-50/60 hover:text-foreground dark:border-yellow-800/40 dark:hover:bg-yellow-950/20"
                            >
                              <Plus className="h-4 w-4" /> Ajouter une étape
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Add block */}
                      <button
                        onClick={addExtrasBlock}
                        className="flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-yellow-300/60 py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-yellow-400 hover:bg-yellow-50/40 hover:text-foreground dark:border-yellow-800/40 dark:hover:bg-yellow-950/20"
                      >
                        <Plus className="h-4 w-4" /> Ajouter un bloc « En cas de »
                      </button>
                    </div>
                  )}

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
                        Échec de l'envoi —{" "}
                        {sendError ?? "vérifiez la configuration Resend et le domaine expéditeur."}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <button
                      onClick={() => routine && saveRoutine({ ...routine, updatedAt: Date.now() })}
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
                      disabled={sending || (routine?.am.length === 0 && routine?.pm.length === 0)}
                      className="flex items-center gap-2 rounded-2xl bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Envoi en cours…
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Envoyer à {selectedUser.displayName?.split(" ")[0] ?? selectedUser.email}
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Dialogs */}
      <StepDialog
        step={editingStep}
        isNew={isNewStep}
        onClose={() => { setEditingStep(null); setEditingExtrasBlockId(null); }}
        onSave={handleSaveStep}
        saving={saving}
        catalogProducts={catalogProducts}
        onSaveToCatalog={handleSaveToCatalog}
        savingToCatalog={savingToCatalog}
      />

      {/* Delete AM/PM step */}
      <AlertDialog open={!!deletingStepId} onOpenChange={(o) => !o && setDeletingStepId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Supprimer cette étape ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette étape sera définitivement supprimée de la routine.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStep} className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete extras block step */}
      <AlertDialog open={!!deletingStepInfo} onOpenChange={(o) => !o && setDeletingStepInfo(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Supprimer cette étape ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette étape sera définitivement supprimée du bloc.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExtrasStep} className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete extras block */}
      <AlertDialog open={!!deletingBlockId} onOpenChange={(o) => !o && setDeletingBlockId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Supprimer ce bloc ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le bloc et toutes ses étapes seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBlock} className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Template picker */}
      <Dialog open={showTemplatePicker} onOpenChange={setShowTemplatePicker}>
        <DialogContent className="max-h-[80vh] overflow-hidden rounded-3xl flex flex-col gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
            <DialogTitle className="font-display">Charger un modèle</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-3 border-b border-border/60">
            <input

              autoComplete="off"              type="text"
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              placeholder="Rechercher un modèle…"
              className="w-full rounded-xl border border-border bg-muted/40 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="overflow-y-auto flex-1 px-3 py-3">
            {filteredTemplates.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {templates.length === 0 ? "Aucun modèle sauvegardé." : "Aucun résultat."}
              </p>
            ) : (
              <ul className="space-y-1">
                {filteredTemplates.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => setPendingTemplate(t)}
                      className="w-full rounded-2xl px-4 py-3 text-left transition-colors hover:bg-muted"
                    >
                      <p className="font-medium text-sm">{t.name}</p>
                      {t.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {t.description}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        AM : {t.am.length} · PM : {t.pm.length} · Blocs bonus : {(t.extras ?? []).length}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm apply template */}
      <AlertDialog open={!!pendingTemplate} onOpenChange={(o) => !o && setPendingTemplate(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Remplacer la routine actuelle ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              La routine de {selectedUser?.displayName ?? selectedUser?.email ?? "cet élève"} sera
              remplacée par le modèle <strong>«&nbsp;{pendingTemplate?.name}&nbsp;»</strong>. Elle
              passera en brouillon.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingTemplate && applyTemplate(pendingTemplate)}
              className="rounded-2xl"
            >
              Appliquer le modèle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save as template */}
      <Dialog open={showSaveTemplate} onOpenChange={setShowSaveTemplate}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Sauvegarder comme modèle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nom du modèle *</label>
              <input

                autoComplete="off"                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="ex. Peau grasse légère, Peau sensible sévère…"
                className="w-full rounded-xl border border-border bg-muted/40 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Description <span className="text-muted-foreground font-normal">(optionnel)</span>
              </label>
              <textarea

                autoComplete="off"                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
                placeholder="Indications, profil type…"
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-muted/40 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              AM : {routine?.am.length ?? 0} étape{(routine?.am.length ?? 0) !== 1 ? "s" : ""} · PM : {routine?.pm.length ?? 0} étape{(routine?.pm.length ?? 0) !== 1 ? "s" : ""} · Blocs bonus : {routine?.extras.length ?? 0}
            </p>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowSaveTemplate(false)}
              className="rounded-2xl border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Annuler
            </button>
            <button
              onClick={saveAsTemplate}
              disabled={savingTemplate || !templateName.trim()}
              className="flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {savingTemplate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BookmarkPlus className="h-4 w-4" />
              )}
              Créer le modèle
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

// ─── Skin Profile Panel ───────────────────────────────────────────────────────

function SkinProfilePanel({ intake, loading }: { intake: IntakeAnswers | null; loading: boolean }) {
  return (
    <aside className="h-fit rounded-3xl border border-border/60 bg-card p-6 shadow-soft lg:sticky lg:top-6">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Profil peau
      </p>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !intake ? (
        <p className="text-sm italic text-muted-foreground">Pas encore de bilan.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Type
              </p>
              <p className="mt-1 text-sm font-semibold">
                {SKIN_TYPE_LABELS[intake.skinType ?? ""] ?? intake.skinType ?? "—"}
              </p>
            </div>
            <div
              className={`rounded-2xl p-3 ${
                intake.intensity === "severe"
                  ? "bg-destructive/10"
                  : intake.intensity === "moderee"
                    ? "bg-orange-50"
                    : "bg-muted/50"
              }`}
            >
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Intensité
              </p>
              <p
                className={`mt-1 text-sm font-semibold ${
                  intake.intensity === "severe"
                    ? "text-destructive"
                    : intake.intensity === "moderee"
                      ? "text-orange-600"
                      : ""
                }`}
              >
                {INTENSITY_LABELS[intake.intensity ?? ""] ?? intake.intensity ?? "—"}
              </p>
            </div>
          </div>

          {(intake.acneTypes?.length ?? 0) > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Types d'acné
              </p>
              <div className="flex flex-wrap gap-1.5">
                {intake.acneTypes!.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary"
                  >
                    {ACNE_TYPE_LABELS[t] ?? t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {intake.currentRoutine && (
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Routine actuelle
              </p>
              <p className="text-xs leading-relaxed text-foreground/80">{intake.currentRoutine}</p>
            </div>
          )}

          {intake.mainGoal && (
            <div>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Objectif
              </p>
              <p className="text-xs leading-relaxed text-foreground/80">{intake.mainGoal}</p>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}


import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { useAuth } from "@/hooks/use-auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { createAdminNotificationFn } from "@/lib/admin-notifications";
import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, UserPlus } from "lucide-react";

export const Route = createFileRoute("/admin_/student/new")({
  head: () => ({
    meta: [{ title: "Nouvel élève — Protocole Clear" }],
  }),
  component: NewStudentPage,
});

// ─────────────────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

type Form = {
  // Identité
  displayName: string;
  email: string;
  // Profil
  ageRange: string;
  gender: string;
  hormonalCycleAcne: string;
  skinType: string;
  acneTypes: string[];
  acneLocations: string[];
  intensity: string;
  // Routine actuelle
  hasRoutine: string;
  currentProducts: string;
  // Historique
  durationAcne: string;
  previousTreatments: string;
  skinReactivity: string;
  hadReactions: string;
  reactionDetails: string;
  // Objectif
  mainGoal: string;
  priorityGoal: string;
};

const EMPTY: Form = {
  displayName: "",
  email: "",
  ageRange: "",
  gender: "",
  hormonalCycleAcne: "",
  skinType: "",
  acneTypes: [],
  acneLocations: [],
  intensity: "",
  hasRoutine: "",
  currentProducts: "",
  durationAcne: "",
  previousTreatments: "",
  skinReactivity: "",
  hadReactions: "",
  reactionDetails: "",
  mainGoal: "",
  priorityGoal: "",
};

// ── Options ───────────────────────────────────────────────────────────────────

const AGE_OPTIONS = [
  { value: "moins_18", label: "< 18 ans" },
  { value: "18_24", label: "18–24 ans" },
  { value: "25_34", label: "25–34 ans" },
  { value: "35_44", label: "35–44 ans" },
  { value: "45_plus", label: "45+ ans" },
];

const GENDER_OPTIONS = [
  { value: "homme", label: "Homme" },
  { value: "femme", label: "Femme" },
  { value: "nr", label: "Non précisé" },
];

const HORMONAL_OPTIONS = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
  { value: "je_sais_pas", label: "Je ne sais pas" },
];

const SKIN_TYPES = [
  { value: "normale", label: "Normale" },
  { value: "grasse", label: "Grasse" },
  { value: "seche", label: "Sèche" },
  { value: "mixte", label: "Mixte" },
  { value: "sensible", label: "Sensible" },
];

const ACNE_TYPES = [
  { value: "comedons", label: "Comédons" },
  { value: "papules", label: "Papules / Pustules" },
  { value: "microkystes", label: "Microkystes" },
  { value: "kystes", label: "Kystes / Nodules" },
];

const ACNE_LOCATIONS = [
  { value: "front", label: "Front" },
  { value: "nez", label: "Nez" },
  { value: "joues", label: "Joues" },
  { value: "menton", label: "Menton" },
  { value: "machoire", label: "Mâchoire" },
  { value: "dos", label: "Dos" },
  { value: "torse", label: "Torse" },
];

const INTENSITY_OPTIONS = [
  { value: "legere", label: "Légère" },
  { value: "moderee", label: "Modérée" },
  { value: "severe", label: "Sévère" },
];

const DURATION_OPTIONS = [
  { value: "moins_3mois", label: "< 3 mois" },
  { value: "3_12mois", label: "3–12 mois" },
  { value: "1_3ans", label: "1–3 ans" },
  { value: "plus_3ans", label: "+ 3 ans" },
];

const REACTIVITY_OPTIONS = [
  { value: "faible", label: "Faible" },
  { value: "moyenne", label: "Moyenne" },
  { value: "elevee", label: "Élevée" },
];

const PRIORITY_OPTIONS = [
  { value: "boutons", label: "Réduire les boutons actifs" },
  { value: "cicatrices", label: "Estomper les cicatrices" },
  { value: "teint", label: "Unifier le teint" },
  { value: "sensibilite", label: "Calmer la sensibilité" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-soft">
      <h2 className="mb-5 font-display text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}{required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

function Pills({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
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

function MultiPills({ options, values, onChange }: { options: { value: string; label: string }[]; values: string[]; onChange: (v: string[]) => void }) {
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

// ── Page ──────────────────────────────────────────────────────────────────────

function NewStudentPage() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
    if (!loading && user && !isAdmin) navigate({ to: "/" });
  }, [user, loading, isAdmin, navigate]);

  if (loading || !user || !isAdmin) return null;

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.displayName.trim()) { setError("Le nom est requis."); return; }
    setError("");
    setSaving(true);

    try {
      const uid = crypto.randomUUID();
      const now = Date.now();

      await setDoc(doc(db, "users", uid), {
        uid,
        email: form.email.trim() || null,
        displayName: form.displayName.trim(),
        photoURL: null,
        enrolledAt: now,
        welcomeSeen: false,
        adminCreated: true,
        accountType: "routine_only",
      });

      const currentRoutineSummary = form.hasRoutine === "oui"
        ? form.currentProducts.trim() || "Oui (produits non précisés)"
        : "Aucune routine actuelle";

      await setDoc(doc(db, "intake_answers", uid), {
        uid,
        ageRange: form.ageRange,
        gender: form.gender,
        hormonalCycleAcne: form.hormonalCycleAcne,
        skinType: form.skinType,
        acneTypes: form.acneTypes,
        acneLocations: form.acneLocations,
        intensity: form.intensity,
        hasRoutine: form.hasRoutine,
        currentProducts: form.currentProducts,
        currentRoutine: currentRoutineSummary,
        durationAcne: form.durationAcne,
        previousTreatments: form.previousTreatments,
        skinReactivity: form.skinReactivity,
        hadReactions: form.hadReactions,
        reactionDetails: form.reactionDetails,
        mainGoal: form.mainGoal.trim(),
        priorityGoal: form.priorityGoal,
        completedAt: now,
        adminCreated: true,
      });

      // Notifications admin ne peuvent pas être créées côté client (rules firestore).
      // On passe par une server function authentifiée (Admin SDK = bypass rules).
      const callerToken = await auth.currentUser?.getIdToken();
      if (!callerToken) throw new Error("Non authentifié");

      await createAdminNotificationFn({
        data: {
          type: "new_student",
          studentUid: uid,
          studentName: form.displayName.trim(),
          studentEmail: form.email.trim() || "",
          callerToken,
        },
      });

      navigate({ to: "/admin/student/$uid", params: { uid } });
    } catch (err: any) {
      setError(err?.message ?? "Erreur inconnue");
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-8 md:pt-12">

        <header className="mb-10">
          <button
            onClick={() => navigate({ to: "/admin" })}
            className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> Retour
          </button>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Admin</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
            Nouvel élève
          </h1>
          <p className="mt-2 text-muted-foreground">
            Crée le profil manuellement pour suivre cet élève dans le dashboard.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">

          <Section title="Identité">
            <Field label="Nom complet" required>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => set("displayName", e.target.value)}
                placeholder="Prénom Nom"
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="optionnel"
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </Field>
          </Section>

          <Section title="Profil">
            <Field label="Tranche d'âge">
              <Pills options={AGE_OPTIONS} value={form.ageRange} onChange={(v) => set("ageRange", v)} />
            </Field>
            <Field label="Genre">
              <Pills options={GENDER_OPTIONS} value={form.gender} onChange={(v) => set("gender", v)} />
            </Field>
            <Field label="Acné liée au cycle hormonal ?">
              <Pills options={HORMONAL_OPTIONS} value={form.hormonalCycleAcne} onChange={(v) => set("hormonalCycleAcne", v)} />
            </Field>
          </Section>

          <Section title="Peau">
            <Field label="Type de peau">
              <Pills options={SKIN_TYPES} value={form.skinType} onChange={(v) => set("skinType", v)} />
            </Field>
            <Field label="Types d'acné">
              <MultiPills options={ACNE_TYPES} values={form.acneTypes} onChange={(v) => set("acneTypes", v)} />
            </Field>
            <Field label="Localisation">
              <MultiPills options={ACNE_LOCATIONS} values={form.acneLocations} onChange={(v) => set("acneLocations", v)} />
            </Field>
            <Field label="Intensité">
              <Pills options={INTENSITY_OPTIONS} value={form.intensity} onChange={(v) => set("intensity", v)} />
            </Field>
          </Section>

          <Section title="Routine actuelle">
            <Field label="A une routine ?">
              <Pills
                options={[{ value: "oui", label: "Oui" }, { value: "non", label: "Non" }]}
                value={form.hasRoutine}
                onChange={(v) => set("hasRoutine", v)}
              />
            </Field>
            {form.hasRoutine === "oui" && (
              <Field label="Produits actuels">
                <textarea
                  value={form.currentProducts}
                  onChange={(e) => set("currentProducts", e.target.value)}
                  rows={3}
                  placeholder="Nettoyant, crème, sérum..."
                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </Field>
            )}
          </Section>

          <Section title="Historique">
            <Field label="Durée de l'acné">
              <Pills options={DURATION_OPTIONS} value={form.durationAcne} onChange={(v) => set("durationAcne", v)} />
            </Field>
            <Field label="Traitements antérieurs">
              <textarea
                value={form.previousTreatments}
                onChange={(e) => set("previousTreatments", e.target.value)}
                rows={2}
                placeholder="Antibiotiques, rétinoïdes, autres..."
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </Field>
            <Field label="Réactivité cutanée">
              <Pills options={REACTIVITY_OPTIONS} value={form.skinReactivity} onChange={(v) => set("skinReactivity", v)} />
            </Field>
            <Field label="Réactions à des produits ?">
              <Pills
                options={[{ value: "oui", label: "Oui" }, { value: "non", label: "Non" }]}
                value={form.hadReactions}
                onChange={(v) => set("hadReactions", v)}
              />
            </Field>
            {form.hadReactions === "oui" && (
              <Field label="Détails des réactions">
                <textarea
                  value={form.reactionDetails}
                  onChange={(e) => set("reactionDetails", e.target.value)}
                  rows={2}
                  placeholder="Produit(s) et réaction(s) observée(s)"
                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </Field>
            )}
          </Section>

          <Section title="Objectif">
            <Field label="Objectif principal">
              <textarea
                value={form.mainGoal}
                onChange={(e) => set("mainGoal", e.target.value)}
                rows={2}
                placeholder="En quelques mots, ce que l'élève veut atteindre"
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </Field>
            <Field label="Priorité">
              <Pills options={PRIORITY_OPTIONS} value={form.priorityGoal} onChange={(v) => set("priorityGoal", v)} />
            </Field>
          </Section>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background shadow-elegant transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Créer le profil
          </button>

        </form>
      </main>
    </AdminShell>
  );
}

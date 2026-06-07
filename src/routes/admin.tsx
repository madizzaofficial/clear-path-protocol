import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { SearchInput } from "@/components/SearchInput";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, addDoc } from "firebase/firestore";
import { useEffect, useState, useMemo } from "react";
import { TrendingUp, Users, CheckCircle2, AlertCircle, AlertTriangle, Loader2, ClipboardList, Check, Search, Salad, Clock, Send, X, Flame, ChevronDown, ChevronUp, LayoutGrid, List, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { course } from "@/lib/course-data";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Protocole Clear" },
      { name: "description", content: "Lumen admin dashboard." },
    ],
  }),
  component: AdminPage,
});

const TOTAL_LESSONS = course.chapters.reduce((sum, ch) => sum + ch.lessons.length, 0);

function formatDays(enrolledAt: number): string {
  const days = Math.floor((Date.now() - enrolledAt) / 86_400_000);
  if (days < 7) return `J+${days}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `${weeks} sem`;
  return `${Math.floor(days / 30)} mois`;
}

type StudentDoc = {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  enrolledAt?: number;
  lastSeen?: number;
};

function AdminPage() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [progressMap, setProgressMap] = useState<Map<string, number>>(new Map());
  const [routineStatusMap, setRoutineStatusMap] = useState<Map<string, "sent" | "draft">>(new Map());
  const [nutritionSet, setNutritionSet] = useState<Set<string>>(new Set());
  const [reportsMap, setReportsMap] = useState<Map<string, number>>(new Map());
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "sent" | "draft" | "none">("all");
  const [filterInactive, setFilterInactive] = useState(false);
  const [hideAdmins, setHideAdmins] = useState<boolean>(() => {
    try { return localStorage.getItem("admin-hide-admins") !== "false"; } catch { return true; }
  });
  const [adminUids, setAdminUids] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"name" | "email" | "status">("name");
  const [quickNoteUid, setQuickNoteUid] = useState<string | null>(null);
  const [quickNoteText, setQuickNoteText] = useState("");
  const [sendingQuickNote, setSendingQuickNote] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  type IrritantEntry = { product: string; category: string; irritant: number; allergie: number; total: number; studentCount: number };
  const [irritantsData, setIrritantsData] = useState<IrritantEntry[]>([]);
  const [showIrritants, setShowIrritants] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
    if (!loading && user && !isAdmin) navigate({ to: "/" });
  }, [user, loading, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    async function fetchStudents() {
      setLoadingStudents(true);
      try {
        const [usersSnap, routinesSnap, nutritionSnap, reportsSnap, adminsSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "routines")),
          getDocs(collection(db, "nutrition")),
          getDocs(collection(db, "routine_reports")),
          getDoc(doc(db, "config", "admins")),
        ]);
        const docs = usersSnap.docs.map((d) => d.data() as StudentDoc);
        setStudents(docs);
        setAdminUids(new Set(adminsSnap.exists() ? (adminsSnap.data().uids ?? []) : []));

        const rMap = new Map<string, "sent" | "draft">();
        routinesSnap.docs.forEach((d) => rMap.set(d.id, (d.data() as { status: "sent" | "draft" }).status));
        setRoutineStatusMap(rMap);

        const nSet = new Set<string>();
        nutritionSnap.docs.forEach((d) => {
          const { toEat = [], toAvoid = [] } = d.data();
          if (toEat.length > 0 || toAvoid.length > 0) nSet.add(d.id);
        });
        setNutritionSet(nSet);

        const rptMap = new Map<string, number>();
        reportsSnap.docs.forEach((d) => {
          const count = Object.keys(d.data()).length;
          if (count > 0) rptMap.set(d.id, count);
        });
        setReportsMap(rptMap);

        // Build step lookup: uid → stepId → { product, category }
        const stepLookup = new Map<string, Map<string, { product: string; category: string }>>();
        routinesSnap.docs.forEach((d) => {
          const data = d.data() as { am?: { id: string; product: string; category: string }[]; pm?: { id: string; product: string; category: string }[]; extras?: { steps?: { id: string; product: string; category: string }[] }[] };
          const steps = new Map<string, { product: string; category: string }>();
          [...(data.am ?? []), ...(data.pm ?? [])].forEach((s) => steps.set(s.id, { product: s.product, category: s.category }));
          (data.extras ?? []).forEach((b) => (b.steps ?? []).forEach((s) => steps.set(s.id, { product: s.product, category: s.category })));
          stepLookup.set(d.id, steps);
        });

        // Aggregate by product name
        const productMap = new Map<string, { product: string; category: string; irritant: number; allergie: number; uids: Set<string> }>();
        reportsSnap.docs.forEach((d) => {
          const stepMap = stepLookup.get(d.id);
          if (!stepMap) return;
          Object.entries(d.data() as Record<string, "irritant" | "allergie">).forEach(([stepId, type]) => {
            const step = stepMap.get(stepId);
            if (!step) return;
            const key = step.product.toLowerCase().trim();
            const entry = productMap.get(key) ?? { product: step.product, category: step.category, irritant: 0, allergie: 0, uids: new Set() };
            entry[type]++;
            entry.uids.add(d.id);
            productMap.set(key, entry);
          });
        });
        setIrritantsData(
          Array.from(productMap.values())
            .map((v) => ({ product: v.product, category: v.category, irritant: v.irritant, allergie: v.allergie, total: v.irritant + v.allergie, studentCount: v.uids.size }))
            .sort((a, b) => b.total - a.total),
        );

        const progressSnaps = await Promise.all(docs.map((s) => getDoc(doc(db, "progress", s.uid))));
        const pMap = new Map<string, number>();
        progressSnaps.forEach((ps, i) => {
          if (ps.exists()) pMap.set(docs[i].uid, (ps.data().completedLessons ?? []).length);
        });
        setProgressMap(pMap);
      } finally {
        setLoadingStudents(false);
      }
    }
    fetchStudents();
  }, [isAdmin]);

  const INACTIVE_THRESHOLD = 7 * 86_400_000;

  const filteredStudents = useMemo(() => {
    const cutoff = Date.now() - INACTIVE_THRESHOLD;
    let result = students;
    if (hideAdmins) result = result.filter((s) => !adminUids.has(s.uid));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.displayName?.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
    }
    if (filterStatus !== "all") {
      result = result.filter((s) => (routineStatusMap.get(s.uid) ?? "none") === filterStatus);
    }
    if (filterInactive) {
      result = result.filter((s) => {
        if (s.lastSeen) return s.lastSeen < cutoff;
        return s.enrolledAt ? s.enrolledAt < cutoff : false;
      });
    }
    return [...result].sort((a, b) => {
      if (sortBy === "email") return a.email.localeCompare(b.email);
      if (sortBy === "status") {
        const o = { sent: 0, draft: 1, none: 2 } as const;
        return (o[routineStatusMap.get(a.uid) ?? "none"]) - (o[routineStatusMap.get(b.uid) ?? "none"]);
      }
      return (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email);
    });
  }, [students, search, filterStatus, filterInactive, hideAdmins, adminUids, sortBy, routineStatusMap]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const totalStudents = students.length;
  const avgCompletion = totalStudents > 0
    ? Math.round(students.reduce((sum, s) => sum + (progressMap.get(s.uid) ?? 0), 0) / totalStudents / TOTAL_LESSONS * 100)
    : 0;
  const completedProtocols = Array.from(progressMap.values()).filter((v) => v === TOTAL_LESSONS).length;
  const atRisk = students.filter((s) => {
    const daysIn = s.enrolledAt ? (Date.now() - s.enrolledAt) / 86_400_000 : 0;
    const pct = (progressMap.get(s.uid) ?? 0) / TOTAL_LESSONS;
    return daysIn > 14 && pct < 0.25;
  }).length;

  function openQuickNote(uid: string, name: string | null) {
    setQuickNoteUid(uid);
    setQuickNoteText(`Coucou ${name ?? ""}! Comment se passe ton protocole ? On est là si tu as des questions 👋`);
  }

  async function sendQuickNote() {
    if (!user || !quickNoteUid || !quickNoteText.trim() || sendingQuickNote) return;
    setSendingQuickNote(true);
    try {
      await addDoc(collection(db, "users", quickNoteUid, "notes"), {
        note: quickNoteText.trim(),
        authorUid: user.uid,
        authorName: user.displayName ?? user.email ?? "Coach",
        studentUid: quickNoteUid,
        createdAt: new Date().toISOString(),
      });
      setQuickNoteUid(null);
      setQuickNoteText("");
      toast.success("Note envoyée.");
    } catch {
      toast.error("Impossible d'envoyer la note.");
    } finally {
      setSendingQuickNote(false);
    }
  }

  return (
    <AdminShell>
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:pt-12">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Admin</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">Dashboard coach</h1>
            <p className="mt-2 text-muted-foreground">Suivez les protocoles, intervenez tôt, célébrez les résultats.</p>
          </div>
          <Link
            to="/admin/student/new"
            className="flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium shadow-soft transition-all hover:bg-muted"
          >
            <UserPlus className="h-4 w-4" />
            Nouvel élève
          </Link>
        </header>

        {/* Stats */}
        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStat icon={Users} label="Élèves inscrits" value={loadingStudents ? "…" : String(totalStudents)} delta="total" />
          <AdminStat icon={TrendingUp} label="Taux de complétion" value={loadingStudents ? "…" : `${avgCompletion}%`} delta="moyenne protocole" />
          <AdminStat icon={CheckCircle2} label="Protocoles terminés" value={loadingStudents ? "…" : String(completedProtocols)} delta={`sur ${totalStudents} élèves`} />
          <AdminStat icon={AlertCircle} label="Élèves à risque" value={loadingStudents ? "…" : String(atRisk)} delta="> 14j, < 25% progression" tone="warn" />
        </div>

        {/* Signalements produits */}
        {!loadingStudents && irritantsData.length > 0 && (
          <div className="mb-8 overflow-hidden rounded-3xl border border-orange-200/60 bg-card shadow-soft dark:border-orange-900/30">
            <button
              onClick={() => setShowIrritants((v) => !v)}
              className="flex w-full items-center justify-between gap-4 px-6 py-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-100 dark:bg-orange-950/40">
                  <Flame className="h-4 w-4 text-orange-500" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Signalements produits</p>
                  <p className="text-xs text-muted-foreground">
                    {irritantsData.length} produit{irritantsData.length !== 1 ? "s" : ""} signalé{irritantsData.length !== 1 ? "s" : ""} · {irritantsData.reduce((s, v) => s + v.total, 0)} signalement{irritantsData.reduce((s, v) => s + v.total, 0) !== 1 ? "s" : ""} au total
                  </p>
                </div>
              </div>
              {showIrritants ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {showIrritants && (
              <div className="border-t border-orange-100/60 dark:border-orange-900/20">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-3 text-left">Produit</th>
                      <th className="px-4 py-3 text-left">Catégorie</th>
                      <th className="px-4 py-3 text-center">Irritants</th>
                      <th className="px-4 py-3 text-center">Allergies</th>
                      <th className="px-4 py-3 text-center">Élèves</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {irritantsData.map((item) => (
                      <tr key={item.product} className="transition-colors hover:bg-muted/20">
                        <td className="px-6 py-3 font-medium">{item.product}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{item.category}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.irritant > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">
                              {item.irritant}
                            </span>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.allergie > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-400">
                              {item.allergie}
                            </span>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-muted-foreground">{item.studentCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {/* Grid/list toggle */}
          <div className="flex rounded-xl bg-muted p-1">
            <button onClick={() => setViewMode("list")} className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${viewMode === "list" ? "bg-card shadow-soft text-foreground" : "text-muted-foreground hover:text-foreground"}`} title="Liste">
              <List className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode("grid")} className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${viewMode === "grid" ? "bg-card shadow-soft text-foreground" : "text-muted-foreground hover:text-foreground"}`} title="Grille">
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Rechercher par nom ou email…"
            className="min-w-[220px] flex-1"
            inputClassName="h-10 w-full rounded-2xl border border-border bg-card pl-10 pr-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            suggestions={search.trim() ? students
              .filter((s) => {
                const q = search.toLowerCase();
                return s.displayName?.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
              })
              .slice(0, 6)
              .map((s) => ({
                id: s.uid,
                label: s.displayName ?? s.email,
                sublabel: s.displayName ? s.email : undefined,
                onSelect: () => navigate({ to: "/admin/student/$uid", params: { uid: s.uid } }),
              })) : []}
          />
          <div className="flex rounded-xl bg-muted p-1">
            {(["all", "sent", "draft", "none"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilterStatus(v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterStatus === v ? "bg-card shadow-soft text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {{ all: "Tous", sent: "Envoyée", draft: "Brouillon", none: "Sans routine" }[v]}
              </button>
            ))}
          </div>
          <button
            onClick={() => setFilterInactive((v) => !v)}
            className={`flex h-10 items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition-colors ${
              filterInactive
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Inactif &gt; 7j
          </button>
          <button
            onClick={() => {
              const next = !hideAdmins;
              setHideAdmins(next);
              try { localStorage.setItem("admin-hide-admins", String(next)); } catch {}
            }}
            className={`flex h-10 items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition-colors ${
              hideAdmins
                ? "border-border bg-card text-muted-foreground hover:text-foreground"
                : "border-primary bg-primary-soft text-primary"
            }`}
          >
            {hideAdmins ? "Élèves seulement" : "Tous (admins inclus)"}
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="h-10 rounded-2xl border border-border bg-card px-4 text-sm outline-none focus:border-primary"
          >
            <option value="name">Trier par nom</option>
            <option value="email">Trier par email</option>
            <option value="status">Trier par statut routine</option>
          </select>
        </div>

        {/* Students — list or grid */}
        {loadingStudents ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : viewMode === "list" ? (
          <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Élève</th>
                    <th className="px-4 py-3 font-medium">Progression</th>
                    <th className="px-4 py-3 font-medium">Durée</th>
                    <th className="px-4 py-3 text-center font-medium">Routine</th>
                    <th className="px-4 py-3 text-center font-medium">Nutrition</th>
                    <th className="px-4 py-3 text-center font-medium">Alertes</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-14 text-center text-sm text-muted-foreground">
                        Aucun élève trouvé.
                      </td>
                    </tr>
                  ) : filteredStudents.map((s) => {
                    const initials = (s.displayName ?? s.email).split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                    const routineStatus = routineStatusMap.get(s.uid) ?? "none";
                    const hasNutrition = nutritionSet.has(s.uid);
                    const done = progressMap.get(s.uid) ?? 0;
                    const pct = Math.round((done / TOTAL_LESSONS) * 100);
                    const isInactive = s.lastSeen ? s.lastSeen < Date.now() - 3 * 86_400_000 : (s.enrolledAt ? s.enrolledAt < Date.now() - 3 * 86_400_000 : false);
                    const reportCount = reportsMap.get(s.uid) ?? 0;
                    return (
                      <tr key={s.uid} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <Link to="/admin/student/$uid" params={{ uid: s.uid }} className="group flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-warm text-xs font-semibold">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold transition-colors group-hover:text-primary">{s.displayName ?? "—"}</p>
                              <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex min-w-[100px] items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs tabular-nums text-muted-foreground">{done}/{TOTAL_LESSONS}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm tabular-nums text-muted-foreground">{s.enrolledAt ? formatDays(s.enrolledAt) : "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            {routineStatus === "sent" ? (
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft" title="Envoyée">
                                <Check className="h-3.5 w-3.5 text-primary" />
                              </div>
                            ) : routineStatus === "draft" ? (
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/40" title="Brouillon">
                                <Clock className="h-3.5 w-3.5 text-orange-500" />
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/40">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            {hasNutrition ? (
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft" title="Configurée">
                                <Check className="h-3.5 w-3.5 text-primary" />
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/40">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            {reportCount > 0 && (
                              <Link to="/admin/student/$uid" params={{ uid: s.uid }} search={{ tab: "routine" }}>
                                <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
                                  <AlertTriangle className="h-3 w-3" />{reportCount}
                                </span>
                              </Link>
                            )}
                            {isInactive && (
                              <span title={`Inactif depuis ${s.lastSeen ? Math.floor((Date.now() - s.lastSeen) / 86_400_000) : "?"}j`} className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-400">
                                <Clock className="h-3 w-3" /> inactif
                              </span>
                            )}
                            {reportCount === 0 && !isInactive && <span className="text-xs text-muted-foreground/40">—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => openQuickNote(s.uid, s.displayName)} title="Envoyer une note" className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                              <Send className="h-3.5 w-3.5" />
                            </button>
                            <Link to="/admin/routines" search={{ uid: s.uid }} title={routineStatus === "none" ? "Créer routine" : "Éditer routine"} className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground text-background transition-opacity hover:opacity-80">
                              <ClipboardList className="h-3.5 w-3.5" />
                            </Link>
                            <Link to="/admin/nutrition" search={{ uid: s.uid }} title={hasNutrition ? "Éditer nutrition" : "Créer nutrition"} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-muted">
                              <Salad className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border/40 px-6 py-3 text-xs text-muted-foreground">
              {filteredStudents.length} élève{filteredStudents.length !== 1 ? "s" : ""}
              {filterStatus !== "all" || search.trim() ? ` sur ${students.length}` : ""}
            </div>
          </div>
        ) : (
          /* ── Grid view ── */
          <div>
            {filteredStudents.length === 0 ? (
              <p className="py-14 text-center text-sm text-muted-foreground">Aucun élève trouvé.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredStudents.map((s) => {
                  const initials = (s.displayName ?? s.email).split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                  const routineStatus = routineStatusMap.get(s.uid) ?? "none";
                  const hasNutrition = nutritionSet.has(s.uid);
                  const done = progressMap.get(s.uid) ?? 0;
                  const pct = Math.round((done / TOTAL_LESSONS) * 100);
                  const isInactive = s.lastSeen ? s.lastSeen < Date.now() - 3 * 86_400_000 : (s.enrolledAt ? s.enrolledAt < Date.now() - 3 * 86_400_000 : false);
                  const reportCount = reportsMap.get(s.uid) ?? 0;
                  return (
                    <div key={s.uid} className={`flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-soft transition-shadow hover:shadow-md ${isInactive ? "border-red-200 dark:border-red-900/40" : "border-border/60"}`}>
                      <Link to="/admin/student/$uid" params={{ uid: s.uid }} className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-warm text-sm font-semibold">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{s.displayName ?? "—"}</p>
                          <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                        </div>
                      </Link>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Progression</span>
                          <span className="tabular-nums">{done}/{TOTAL_LESSONS}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      {/* Chips */}
                      <div className="flex flex-wrap gap-1.5">
                        {s.enrolledAt && (
                          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{formatDays(s.enrolledAt)}</span>
                        )}
                        {routineStatus === "sent" && (
                          <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">Routine ✓</span>
                        )}
                        {routineStatus === "draft" && (
                          <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">Brouillon</span>
                        )}
                        {hasNutrition && (
                          <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">Nutrition ✓</span>
                        )}
                        {reportCount > 0 && (
                          <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
                            ⚠ {reportCount} signalement{reportCount > 1 ? "s" : ""}
                          </span>
                        )}
                        {isInactive && (
                          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-400">
                            Inactif &gt;3j
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 border-t border-border/40 pt-3">
                        <button onClick={() => openQuickNote(s.uid, s.displayName)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                          <Send className="h-3.5 w-3.5" />
                        </button>
                        <Link to="/admin/routines" search={{ uid: s.uid }} className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground text-background transition-opacity hover:opacity-80">
                          <ClipboardList className="h-3.5 w-3.5" />
                        </Link>
                        <Link to="/admin/nutrition" search={{ uid: s.uid }} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border transition-colors hover:bg-muted">
                          <Salad className="h-3.5 w-3.5" />
                        </Link>
                        <Link to="/admin/student/$uid" params={{ uid: s.uid }} className="ml-auto flex h-8 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted">
                          Fiche élève
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              {filteredStudents.length} élève{filteredStudents.length !== 1 ? "s" : ""}
              {filterStatus !== "all" || search.trim() ? ` sur ${students.length}` : ""}
            </p>
          </div>
        )}
      </main>

      {/* Quick note modal */}
      {quickNoteUid && (() => {
        const student = students.find((s) => s.uid === quickNoteUid);
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center">
            <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-elegant">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Note rapide</p>
                  <p className="mt-0.5 text-sm font-semibold">{student?.displayName ?? student?.email}</p>
                </div>
                <button
                  onClick={() => setQuickNoteUid(null)}
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <textarea

                autoComplete="off"                value={quickNoteText}
                onChange={(e) => setQuickNoteText(e.target.value)}
                rows={4}
                className="w-full resize-none rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => setQuickNoteUid(null)}
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                >
                  Annuler
                </button>
                <button
                  onClick={sendQuickNote}
                  disabled={sendingQuickNote || !quickNoteText.trim()}
                  className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {sendingQuickNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Envoyer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </AdminShell>
  );
}

function AdminStat({ icon: Icon, label, value, delta, tone }: { icon: any; label: string; value: string; delta: string; tone?: "warn" }) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${tone === "warn" ? "bg-destructive/10 text-destructive" : "bg-primary-soft text-primary"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{delta}</p>
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, addDoc } from "firebase/firestore";
import { useEffect, useState, useMemo } from "react";
import { TrendingUp, Users, CheckCircle2, AlertCircle, AlertTriangle, Loader2, ClipboardList, Check, Search, Salad, Clock, Send, X } from "lucide-react";
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
  const [sortBy, setSortBy] = useState<"name" | "email" | "status">("name");
  const [quickNoteUid, setQuickNoteUid] = useState<string | null>(null);
  const [quickNoteText, setQuickNoteText] = useState("");
  const [sendingQuickNote, setSendingQuickNote] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
    if (!loading && user && !isAdmin) navigate({ to: "/" });
  }, [user, loading, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    async function fetchStudents() {
      setLoadingStudents(true);
      try {
        const [usersSnap, routinesSnap, nutritionSnap, reportsSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "routines")),
          getDocs(collection(db, "nutrition")),
          getDocs(collection(db, "routine_reports")),
        ]);
        const docs = usersSnap.docs.map((d) => d.data() as StudentDoc);
        setStudents(docs);

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
  }, [students, search, filterStatus, filterInactive, sortBy, routineStatusMap]);

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
        <header className="mb-10">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Admin</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">Dashboard coach</h1>
          <p className="mt-2 text-muted-foreground">Suivez les protocoles, intervenez tôt, célébrez les résultats.</p>
        </header>

        {/* Stats */}
        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStat icon={Users} label="Élèves inscrits" value={loadingStudents ? "…" : String(totalStudents)} delta="total" />
          <AdminStat icon={TrendingUp} label="Taux de complétion" value={loadingStudents ? "…" : `${avgCompletion}%`} delta="moyenne protocole" />
          <AdminStat icon={CheckCircle2} label="Protocoles terminés" value={loadingStudents ? "…" : String(completedProtocols)} delta={`sur ${totalStudents} élèves`} />
          <AdminStat icon={AlertCircle} label="Élèves à risque" value={loadingStudents ? "…" : String(atRisk)} delta="> 14j, < 25% progression" tone="warn" />
        </div>

        {/* Controls */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou email…"
              className="h-10 w-full rounded-2xl border border-border bg-card pl-10 pr-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
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

        {/* Students table — full width */}
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
          {loadingStudents ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
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
                          <div className="flex justify-center">
                            {(reportsMap.get(s.uid) ?? 0) > 0 ? (
                              <Link to="/admin/student/$uid" params={{ uid: s.uid }} search={{ tab: "routine" }}>
                                <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
                                  <AlertTriangle className="h-3 w-3" />
                                  {reportsMap.get(s.uid)}
                                </span>
                              </Link>
                            ) : (
                              <span className="text-xs text-muted-foreground/40">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openQuickNote(s.uid, s.displayName)}
                              title="Envoyer une note"
                              className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                            >
                              <Send className="h-3.5 w-3.5" />
                            </button>
                            <Link
                              to="/admin/routines"
                              search={{ uid: s.uid }}
                              title={routineStatus === "none" ? "Créer routine" : "Éditer routine"}
                              className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground text-background transition-opacity hover:opacity-80"
                            >
                              <ClipboardList className="h-3.5 w-3.5" />
                            </Link>
                            <Link
                              to="/admin/nutrition"
                              search={{ uid: s.uid }}
                              title={hasNutrition ? "Éditer nutrition" : "Créer nutrition"}
                              className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-muted"
                            >
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
          )}
          {!loadingStudents && (
            <div className="border-t border-border/40 px-6 py-3 text-xs text-muted-foreground">
              {filteredStudents.length} élève{filteredStudents.length !== 1 ? "s" : ""}
              {filterStatus !== "all" || search.trim() ? ` sur ${students.length}` : ""}
            </div>
          )}
        </div>
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
                value={quickNoteText}
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

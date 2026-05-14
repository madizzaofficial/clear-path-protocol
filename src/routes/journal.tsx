import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { db, storage } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  ArrowLeftRight,
  Loader2,
  Check,
  Save,
  Upload,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Angle = "front" | "left" | "right";

type PhotoEntry = {
  uid: string;
  date: string; // "YYYY-MM-DD"
  front: string | null;
  left: string | null;
  right: string | null;
  note: string;
  createdAt: number;
  updatedAt: number;
};

const ANGLES: { key: Angle; label: string; icon: string }[] = [
  { key: "front", label: "Face avant", icon: "👁" },
  { key: "left", label: "Côté gauche", icon: "◀" },
  { key: "right", label: "Côté droit", icon: "▶" },
];

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/journal")({
  head: () => ({ meta: [{ title: "Mon Journal — Lumen" }] }),
  component: JournalPage,
});

function JournalPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <JournalContent uid={user.uid} />;
}

// ─── Main content ─────────────────────────────────────────────────────────────

function JournalContent({ uid }: { uid: string }) {
  const today = todayStr();
  const entryId = `${uid}_${today}`;

  const [history, setHistory] = useState<PhotoEntry[]>([]);
  const [todayEntry, setTodayEntry] = useState<PhotoEntry | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [uploading, setUploading] = useState<Partial<Record<Angle, boolean>>>({});
  const [uploadedAngles, setUploadedAngles] = useState<Set<Angle>>(new Set());
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [activeView, setActiveView] = useState<"journal" | "compare">("journal");

  // Compare state
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [compareAngle, setCompareAngle] = useState<Angle>("front");

  useEffect(() => {
    async function load() {
      setLoadingData(true);
      try {
        const q = query(
          collection(db, "progress_photos"),
          where("uid", "==", uid)
        );
        const snap = await getDocs(q);
        const entries = snap.docs
          .map((d) => d.data() as PhotoEntry)
          .sort((a, b) => b.date.localeCompare(a.date));

        setHistory(entries);

        const entry = entries.find((e) => e.date === today) ?? null;
        setTodayEntry(entry);
        setNote(entry?.note ?? "");

        // Default compare dates: oldest → newest
        if (entries.length >= 2) {
          setCompareA(entries[entries.length - 1].date);
          setCompareB(entries[0].date);
        } else if (entries.length === 1) {
          setCompareA(entries[0].date);
          setCompareB(entries[0].date);
        }
      } catch (err) {
        console.error("Erreur chargement journal :", err);
      } finally {
        setLoadingData(false);
      }
    }
    load();
  }, [uid, today]);

  async function handleUpload(angle: Angle, file: File) {
    setUploading((prev) => ({ ...prev, [angle]: true }));
    try {
      const storageRef = ref(
        storage,
        `progress_photos/${uid}/${today}-${angle}`
      );
      await uploadBytesResumable(storageRef, file);
      const url = await getDownloadURL(storageRef);

      // merge: true preserves other angles already saved (avoids overwrite race)
      await setDoc(
        doc(db, "progress_photos", entryId),
        { uid, date: today, [angle]: url, updatedAt: Date.now() },
        { merge: true }
      );

      // Functional updates avoid stale closure over todayEntry / history
      setTodayEntry((prev) => ({
        uid,
        date: today,
        front: null,
        left: null,
        right: null,
        note: "",
        createdAt: Date.now(),
        ...(prev ?? {}),
        [angle]: url,
        updatedAt: Date.now(),
      } as PhotoEntry));

      setHistory((prev) => {
        const existing = prev.find((e) => e.date === today);
        const newEntry: PhotoEntry = {
          uid,
          date: today,
          front: null,
          left: null,
          right: null,
          note: "",
          createdAt: Date.now(),
          ...(existing ?? {}),
          [angle]: url,
          updatedAt: Date.now(),
        } as PhotoEntry;
        const idx = prev.findIndex((e) => e.date === today);
        return idx >= 0
          ? [...prev.slice(0, idx), newEntry, ...prev.slice(idx + 1)]
          : [newEntry, ...prev];
      });

      setUploadedAngles((prev) => new Set([...prev, angle]));
      setTimeout(() => setUploadedAngles((prev) => { const n = new Set(prev); n.delete(angle); return n; }), 2000);
    } catch (err) {
      console.error("Échec de l'upload photo :", err);
      alert("L'upload a échoué. Vérifie ta connexion et réessaie.");
    } finally {
      setUploading((prev) => ({ ...prev, [angle]: false }));
    }
  }

  async function saveNote() {
    setSavingNote(true);
    try {
      await setDoc(
        doc(db, "progress_photos", entryId),
        { uid, date: today, note, updatedAt: Date.now() },
        { merge: true }
      );
      setTodayEntry((prev) => prev ? { ...prev, note, updatedAt: Date.now() } : {
        uid,
        date: today,
        front: null,
        left: null,
        right: null,
        note,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    } catch (err) {
      console.error("Échec de la sauvegarde de la note :", err);
    } finally {
      setSavingNote(false);
    }
  }

  const compareEntryA = history.find((e) => e.date === compareA) ?? null;
  const compareEntryB = history.find((e) => e.date === compareB) ?? null;
  const pastHistory = history.filter((e) => e.date !== today);

  return (
    <AppShell>
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-8 md:pt-12">
        {/* Header */}
        <header className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Protocole Clear</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Mon Journal
          </h1>
          <p className="mt-2 text-muted-foreground">
            Photographiez votre peau chaque jour et comparez l'évolution.
          </p>
        </header>

        {/* Tab switcher */}
        <div className="mb-6 flex gap-2 rounded-2xl bg-muted p-1.5">
          <button
            onClick={() => setActiveView("journal")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all ${
              activeView === "journal"
                ? "bg-card shadow-soft text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Camera className="h-4 w-4" /> Journal
          </button>
          <button
            onClick={() => setActiveView("compare")}
            disabled={history.filter((e) => e.date !== today).length < 1 && !todayEntry}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all disabled:opacity-40 ${
              activeView === "compare"
                ? "bg-card shadow-soft text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowLeftRight className="h-4 w-4" /> Comparer
          </button>
        </div>

        {loadingData ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : activeView === "journal" ? (
          <>
            {/* Today's check-in */}
            <section className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-semibold">
                    Aujourd'hui
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(today)}
                  </p>
                </div>
                {todayEntry && (todayEntry.front || todayEntry.left || todayEntry.right || todayEntry.note) && (
                  <span className="flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-foreground">
                    <Check className="h-3 w-3 text-primary" /> Check-in effectué
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 md:gap-4">
                {ANGLES.map(({ key, label, icon }) => (
                  <PhotoCard
                    key={key}
                    label={label}
                    icon={icon}
                    angle={key}
                    url={todayEntry?.[key] ?? null}
                    isUploading={uploading[key] ?? false}
                    isUploaded={uploadedAngles.has(key)}
                    onUpload={handleUpload}
                  />
                ))}
              </div>

              {/* Note du jour */}
              <div className="mt-4 overflow-hidden rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
                <label className="mb-2 block text-sm font-medium text-foreground/80">
                  Note du jour
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Comment se sent votre peau aujourd'hui ? Rougeurs, sécheresse, éclat…"
                  rows={3}
                  className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                />
                <div className="mt-3 flex items-center justify-end gap-3">
                  <AnimatePresence>
                    {noteSaved && (
                      <motion.span
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1 text-xs font-medium text-primary"
                      >
                        <Check className="h-3 w-3" /> Sauvegardée
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={saveNote}
                    disabled={savingNote}
                    className="flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {savingNote ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Sauvegarder
                  </button>
                </div>
              </div>
            </section>

            {/* History */}
            {pastHistory.length > 0 && (
              <section>
                <h2 className="mb-4 font-display text-xl font-semibold">
                  Historique
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {pastHistory.map((entry) => (
                    <HistoryCard key={entry.date} entry={entry} />
                  ))}
                </div>
              </section>
            )}

            {history.length === 0 && (
              <div className="mt-4 rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
                <Camera className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  Commencez votre journal dès aujourd'hui
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Ajoutez vos premières photos ci-dessus
                </p>
              </div>
            )}
          </>
        ) : (
          <CompareSection
            history={history}
            compareA={compareA}
            compareB={compareB}
            compareAngle={compareAngle}
            compareEntryA={compareEntryA}
            compareEntryB={compareEntryB}
            onSetA={setCompareA}
            onSetB={setCompareB}
            onSetAngle={setCompareAngle}
          />
        )}
      </main>
    </AppShell>
  );
}

// ─── Photo Card ───────────────────────────────────────────────────────────────

function PhotoCard({
  label,
  icon,
  angle,
  url,
  isUploading,
  isUploaded,
  onUpload,
}: {
  label: string;
  icon: string;
  angle: Angle;
  url: string | null;
  isUploading: boolean;
  isUploaded: boolean;
  onUpload: (angle: Angle, file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(url);

  // Sync preview with url prop (e.g. after upload)
  useEffect(() => {
    if (url) setPreview(url);
  }, [url]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onUpload(angle, file);
    e.target.value = "";
  }

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />

      {/* Photo area */}
      <button
        onClick={() => inputRef.current?.click()}
        className="relative flex aspect-[3/4] w-full items-center justify-center bg-muted/30"
        disabled={isUploading}
      >
        {preview ? (
          <img
            src={preview}
            alt={label}
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Camera className="h-6 w-6 text-muted-foreground/40" />
            <span className="text-xs text-muted-foreground/60">Ajouter</span>
          </div>
        )}

        {/* Upload overlay */}
        <AnimatePresence>
          {isUploading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm"
            >
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </motion.div>
          )}
          {isUploaded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center bg-green-500/20 backdrop-blur-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 shadow-lg">
                <Check className="h-5 w-5 text-white" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Change photo overlay on hover */}
        {preview && !isUploading && (
          <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
            <div className="mb-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-foreground">
              <Upload className="h-3 w-3" /> Changer
            </div>
          </div>
        )}
      </button>

      {/* Label */}
      <div className="px-3 py-2.5 text-center">
        <p className="text-xs font-medium text-foreground/80">{label}</p>
      </div>
    </div>
  );
}

// ─── History Card ─────────────────────────────────────────────────────────────

function HistoryCard({ entry }: { entry: PhotoEntry }) {
  const mainPhoto = entry.front ?? entry.left ?? entry.right;
  const count = [entry.front, entry.left, entry.right].filter(Boolean).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft">
      <div className="relative aspect-[3/4] bg-muted/30">
        {mainPhoto ? (
          <img
            src={mainPhoto}
            alt={entry.date}
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Camera className="h-5 w-5 text-muted-foreground/30" />
          </div>
        )}
        {/* Photo count badge */}
        <div className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          {count}/3
        </div>
      </div>
      <div className="p-2.5">
        <p className="text-xs font-semibold">{formatDateShort(entry.date)}</p>
        {entry.note && (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
            {entry.note}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatGap(dateA: string, dateB: string): string {
  if (!dateA || !dateB || dateA === dateB) return "Même jour";
  const a = new Date(dateA + "T00:00:00");
  const b = new Date(dateB + "T00:00:00");
  const [early, late] = a < b ? [a, b] : [b, a];
  const totalDays = Math.round((late.getTime() - early.getTime()) / 86_400_000);
  if (totalDays < 30) return `${totalDays} jour${totalDays > 1 ? "s" : ""}`;
  let months =
    (late.getFullYear() - early.getFullYear()) * 12 + late.getMonth() - early.getMonth();
  let rem = Math.round(
    (late.getTime() - new Date(early.getFullYear(), early.getMonth() + months, early.getDate()).getTime()) /
      86_400_000
  );
  if (rem < 0) {
    months--;
    rem = Math.round(
      (late.getTime() - new Date(early.getFullYear(), early.getMonth() + months, early.getDate()).getTime()) /
        86_400_000
    );
  }
  if (months < 12) return `${months} mois${rem > 0 ? ` et ${rem} jour${rem > 1 ? "s" : ""}` : ""}`;
  const years = Math.floor(months / 12);
  const remM = months % 12;
  let s = `${years} an${years > 1 ? "s" : ""}`;
  if (remM > 0) s += ` ${remM} mois`;
  if (rem > 0) s += ` et ${rem} jour${rem > 1 ? "s" : ""}`;
  return s;
}

// ─── Compare Section ──────────────────────────────────────────────────────────

function CompareSection({
  history,
  compareA,
  compareB,
  compareAngle,
  compareEntryA,
  compareEntryB,
  onSetA,
  onSetB,
  onSetAngle,
}: {
  history: PhotoEntry[];
  compareA: string;
  compareB: string;
  compareAngle: Angle;
  compareEntryA: PhotoEntry | null;
  compareEntryB: PhotoEntry | null;
  onSetA: (d: string) => void;
  onSetB: (d: string) => void;
  onSetAngle: (a: Angle) => void;
}) {
  // Oldest-first for left-to-right slider direction
  const dates = useMemo(() => [...history].reverse().map((e) => e.date), [history]);
  const max = Math.max(0, dates.length - 1);
  const idxA = Math.max(0, dates.indexOf(compareA));
  const idxB = (() => { const i = dates.indexOf(compareB); return i >= 0 ? i : max; })();

  const photoA = compareEntryA?.[compareAngle] ?? null;
  const photoB = compareEntryB?.[compareAngle] ?? null;
  const gap = compareA && compareB ? formatGap(compareA, compareB) : null;

  function nearestDate(target: string): string {
    if (!dates.length) return "";
    const t = new Date(target + "T00:00:00").getTime();
    return dates.reduce((best, d) =>
      Math.abs(new Date(d + "T00:00:00").getTime() - t) <
      Math.abs(new Date(best + "T00:00:00").getTime() - t)
        ? d
        : best
    );
  }

  if (history.length < 2) {
    return (
      <p className="rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        Ajoutez au moins 2 entrées dans votre journal pour utiliser la comparaison.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* Slider card */}
      <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
        <DateRangeSlider
          dates={dates}
          idxA={idxA}
          idxB={idxB}
          onChangeA={(i) => onSetA(dates[i])}
          onChangeB={(i) => onSetB(dates[i])}
        />

        {/* Gap indicator */}
        {gap && (
          <p className="mt-4 text-center text-sm font-semibold text-primary">
            {gap === "Même jour" ? "Même jour" : `Écart : ${gap}`}
          </p>
        )}

        {/* Manual date inputs */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Date A
            </p>
            <input
              type="date"
              value={compareA}
              min={dates[0]}
              max={dates[max]}
              onChange={(e) => { if (e.target.value) onSetA(nearestDate(e.target.value)); }}
              className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Date B
            </p>
            <input
              type="date"
              value={compareB}
              min={dates[0]}
              max={dates[max]}
              onChange={(e) => { if (e.target.value) onSetB(nearestDate(e.target.value)); }}
              className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      {/* Angle tabs */}
      <div className="flex gap-2 rounded-2xl bg-muted p-1.5">
        {ANGLES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onSetAngle(key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all ${
              compareAngle === key
                ? "bg-card shadow-soft text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Side-by-side photos */}
      <div className="grid grid-cols-2 gap-3">
        <CompareSlot label={compareA ? formatDate(compareA) : "Date A"} photo={photoA} side="A" />
        <CompareSlot label={compareB ? formatDate(compareB) : "Date B"} photo={photoB} side="B" />
      </div>
    </div>
  );
}

// ─── Date Range Slider ────────────────────────────────────────────────────────

function DateRangeSlider({
  dates,
  idxA,
  idxB,
  onChangeA,
  onChangeB,
}: {
  dates: string[];
  idxA: number;
  idxB: number;
  onChangeA: (i: number) => void;
  onChangeB: (i: number) => void;
}) {
  const max = Math.max(1, dates.length - 1);
  const pctA = (idxA / max) * 100;
  const pctB = (idxB / max) * 100;
  const lo = Math.min(pctA, pctB);
  const hi = Math.max(pctA, pctB);

  const thumbCls =
    "pointer-events-none absolute inset-0 w-full h-full appearance-none bg-transparent outline-none " +
    "[&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-0 " +
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none " +
    "[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full " +
    "[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md " +
    "[&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-white " +
    "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 " +
    "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer " +
    "[&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:ring-2 [&::-moz-range-thumb]:ring-white " +
    "[&::-moz-range-thumb]:border-none [&::-moz-range-track]:bg-transparent";

  return (
    <div>
      <div className="relative h-6">
        {/* Track */}
        <div className="pointer-events-none absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1.5 rounded-full bg-muted">
          <div
            className="absolute h-full rounded-full bg-primary"
            style={{ left: `${lo}%`, right: `${100 - hi}%` }}
          />
        </div>

        {/* Handle A — primary */}
        <input
          type="range"
          min={0}
          max={max}
          value={idxA}
          onChange={(e) => onChangeA(Number(e.target.value))}
          className={`${thumbCls} [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:bg-primary`}
          style={{ zIndex: idxA > idxB ? 4 : 3 }}
        />

        {/* Handle B — foreground */}
        <input
          type="range"
          min={0}
          max={max}
          value={idxB}
          onChange={(e) => onChangeB(Number(e.target.value))}
          className={`${thumbCls} [&::-webkit-slider-thumb]:bg-foreground [&::-moz-range-thumb]:bg-foreground`}
          style={{ zIndex: idxA > idxB ? 3 : 4 }}
        />
      </div>

      {/* Date labels */}
      <div className="relative mt-2 h-4">
        <span
          className="absolute -translate-x-1/2 text-[11px] font-semibold text-primary whitespace-nowrap"
          style={{ left: `${pctA}%` }}
        >
          {dates[idxA] ? formatDateShort(dates[idxA]) : ""}
        </span>
        <span
          className="absolute -translate-x-1/2 text-[11px] font-medium text-foreground/60 whitespace-nowrap"
          style={{ left: `${pctB}%` }}
        >
          {dates[idxB] && dates[idxB] !== dates[idxA] ? formatDateShort(dates[idxB]) : ""}
        </span>
      </div>
    </div>
  );
}

function CompareSlot({
  label,
  photo,
  side,
}: {
  label: string;
  photo: string | null;
  side: "A" | "B";
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-soft text-[11px] font-bold text-primary">
          {side}
        </span>
        <p className="truncate text-xs font-medium text-foreground/80">{label}</p>
      </div>
      <div className="relative aspect-[3/4] bg-muted/30">
        {photo ? (
          <img
            src={photo}
            alt={label}
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <Camera className="h-6 w-6 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground/60">
              Pas de photo pour cet angle
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

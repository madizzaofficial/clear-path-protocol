import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { db, storage } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  ArrowLeftRight,
  Loader2,
  Check,
  Save,
  Upload,
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCcw,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import * as SliderPrimitive from "@radix-ui/react-slider";

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

function photoWeek(date: string, enrolledAt: number): number {
  return Math.max(1, Math.ceil((new Date(date).getTime() - enrolledAt) / (7 * 86_400_000)) + 1);
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
  const [enrolledAt, setEnrolledAt] = useState<number | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [uploading, setUploading] = useState<Partial<Record<Angle, boolean>>>({});
  const [uploadedAngles, setUploadedAngles] = useState<Set<Angle>>(new Set());
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [activeView, setActiveView] = useState<"journal" | "compare">("journal");
  const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);

  // Compare state
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [compareAngle, setCompareAngle] = useState<Angle>("front");

  useEffect(() => {
    async function load() {
      setLoadingData(true);
      try {
        const [snap, userSnap] = await Promise.all([
          getDocs(query(collection(db, "progress_photos"), where("uid", "==", uid))),
          getDoc(doc(db, "users", uid)),
        ]);
        if (userSnap.exists()) setEnrolledAt(userSnap.data().enrolledAt ?? null);
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
      toast.error("L'upload a échoué. Vérifie ta connexion et réessaie.");
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
      toast.error("Échec de la sauvegarde. Réessaie.");
    } finally {
      setSavingNote(false);
    }
  }

  const compareEntryA = history.find((e) => e.date === compareA) ?? null;
  const compareEntryB = history.find((e) => e.date === compareB) ?? null;
  const pastHistory = history.filter((e) => e.date !== today);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selectedIdx = selectedDate ? pastHistory.findIndex((e) => e.date === selectedDate) : -1;
  const selectedEntry = selectedIdx >= 0 ? pastHistory[selectedIdx] : null;

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:pt-12">
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
          <div className="flex flex-1 flex-col items-center">
            <button
              onClick={() => setActiveView("compare")}
              disabled={history.filter((e) => e.date !== today).length < 1 && !todayEntry}
              title={history.filter((e) => e.date !== today).length < 1 && !todayEntry ? "Ajoutez au moins 2 entrées pour comparer" : undefined}
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all disabled:opacity-40 ${
                activeView === "compare"
                  ? "bg-card shadow-soft text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ArrowLeftRight className="h-4 w-4" /> Comparer
            </button>
            {history.filter((e) => e.date !== today).length < 1 && !todayEntry && (
              <span className="mt-0.5 text-[10px] text-muted-foreground/50">2 entrées minimum</span>
            )}
          </div>
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
                    onZoom={setZoomedPhoto}
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
                    <HistoryCard key={entry.date} entry={entry} onClick={() => setSelectedDate(entry.date)} />
                  ))}
                </div>
              </section>
            )}

            {/* Timeline */}
            {enrolledAt && history.length > 0 && (() => {
              const chronological = [...history].reverse();
              const map = new Map<number, PhotoEntry[]>();
              for (const p of chronological) {
                const w = photoWeek(p.date, enrolledAt);
                if (!map.has(w)) map.set(w, []);
                map.get(w)!.push(p);
              }
              const groups = [...map.entries()].map(([week, photos]) => ({ week, photos }));
              return (
                <section className="mt-8">
                  <h2 className="mb-4 font-display text-xl font-semibold">Ta progression</h2>
                  <div className="space-y-6">
                    {groups.map(({ week, photos }) => (
                      <div key={week}>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Semaine {Math.min(week, 12)}
                        </p>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                          {photos.map((p) => {
                            const mainPhoto = p.front ?? p.left ?? p.right;
                            return (
                              <button
                                key={p.date}
                                type="button"
                                onClick={() => setSelectedDate(p.date)}
                                className="shrink-0 text-left hover:opacity-80 transition-opacity"
                              >
                                <div className="relative h-32 w-24 overflow-hidden rounded-2xl bg-muted/30">
                                  {mainPhoto ? (
                                    <img src={mainPhoto} alt={p.date} className="h-full w-full object-cover object-top" />
                                  ) : (
                                    <div className="flex h-full items-center justify-center">
                                      <Camera className="h-5 w-5 text-muted-foreground/30" />
                                    </div>
                                  )}
                                </div>
                                <p className="mt-1 text-center text-[11px] text-muted-foreground">
                                  {formatDateShort(p.date)}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })()}

            <PhotoDetailDialog
              entry={selectedEntry}
              open={selectedEntry !== null}
              onClose={() => setSelectedDate(null)}
              hasPrev={selectedIdx > 0}
              hasNext={selectedIdx < pastHistory.length - 1}
              onPrev={() => selectedIdx > 0 && setSelectedDate(pastHistory[selectedIdx - 1].date)}
              onNext={() => selectedIdx < pastHistory.length - 1 && setSelectedDate(pastHistory[selectedIdx + 1].date)}
              onZoom={setZoomedPhoto}
              isZoomed={zoomedPhoto !== null}
            />

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
            onZoom={setZoomedPhoto}
            onReset={() => {
              const sorted = [...history].reverse();
              if (sorted.length >= 2) {
                setCompareA(sorted[0].date);
                setCompareB(sorted[sorted.length - 1].date);
              }
            }}
          />
        )}
      </main>

      {/* Full-screen zoom overlay — rendered at page level so it's above everything */}
      {zoomedPhoto && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setZoomedPhoto(null)}
        >
          <img
            src={zoomedPhoto}
            alt="Photo agrandie"
            className="max-h-screen max-w-full object-contain p-4"
          />
        </div>
      )}
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
  onZoom,
}: {
  label: string;
  icon: string;
  angle: Angle;
  url: string | null;
  isUploading: boolean;
  isUploaded: boolean;
  onUpload: (angle: Angle, file: File) => void;
  onZoom?: (url: string) => void;
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

        {/* Bouton zoom mobile — toujours visible sur touch, caché sur desktop */}
        {preview && onZoom && !isUploading && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onZoom(preview); }}
            className="sm:hidden absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </button>
        )}

        {/* Change photo overlay on hover — desktop uniquement */}
        {preview && !isUploading && (
          <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
            <div className="mb-3 flex items-center gap-2">
              {onZoom && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onZoom(preview); }}
                  className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-foreground"
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  Voir
                </button>
              )}
              <div className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-foreground">
                <Upload className="h-3 w-3" /> Changer
              </div>
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

function HistoryCard({ entry, onClick }: { entry: PhotoEntry; onClick?: () => void }) {
  const mainPhoto = entry.front ?? entry.left ?? entry.right;
  const count = [entry.front, entry.left, entry.right].filter(Boolean).length;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft cursor-pointer hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow">
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
    </button>
  );
}

// ─── Photo Detail Dialog ──────────────────────────────────────────────────────

function PhotoDetailDialog({
  entry,
  open,
  onClose,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onZoom,
  isZoomed,
}: {
  entry: PhotoEntry | null;
  open: boolean;
  onClose: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onZoom: (url: string) => void;
  isZoomed: boolean;
}) {
  const [angleIdx, setAngleIdx] = useState(0);
  useEffect(() => { setAngleIdx(0); }, [entry?.date]);

  const currentAngle = ANGLES[angleIdx];
  const currentPhoto = entry?.[currentAngle.key as Angle] ?? null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-2xl p-0 overflow-hidden rounded-3xl max-h-[90dvh] flex flex-col"
        onInteractOutside={(e) => { if (isZoomed) e.preventDefault(); }}
      >
        {/* Header — date + prev/next jour */}
        <DialogHeader className="shrink-0 px-5 pt-5 pb-3 border-b border-border/50">
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="font-display text-lg">
              {entry ? formatDate(entry.date) : ""}
            </DialogTitle>
            <div className="flex items-center gap-1">
              <button type="button" onClick={onPrev} disabled={!hasPrev}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={onNext} disabled={!hasNext}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto flex-1">
          {/* Mobile — une photo à la fois avec navigation d'angle */}
          <div className="sm:hidden">
            <div className="relative">
              <button type="button" onClick={() => setAngleIdx(i => Math.max(0, i - 1))} disabled={angleIdx === 0}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 shadow-md disabled:opacity-30">
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="relative aspect-[3/4] bg-muted/30">
                {currentPhoto ? (
                  <img src={currentPhoto} alt={currentAngle.label}
                    onClick={() => onZoom(currentPhoto)}
                    className="h-full w-full cursor-zoom-in object-cover object-top" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Camera className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                )}
              </div>

              <button type="button" onClick={() => setAngleIdx(i => Math.min(ANGLES.length - 1, i + 1))} disabled={angleIdx === ANGLES.length - 1}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 shadow-md disabled:opacity-30">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-2 py-3">
              <p className="text-sm font-medium">{currentAngle.label}</p>
              <div className="flex gap-1.5">
                {ANGLES.map((_, i) => (
                  <button key={i} type="button" onClick={() => setAngleIdx(i)}
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${i === angleIdx ? "bg-primary" : "bg-muted-foreground/30"}`} />
                ))}
              </div>
            </div>
          </div>

          {/* Desktop — grille 3 colonnes */}
          <div className="hidden sm:grid sm:grid-cols-3 gap-3 p-5">
            {ANGLES.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <p className="text-center text-xs font-medium text-muted-foreground">{label}</p>
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted/30">
                  {entry?.[key as Angle] ? (
                    <img src={entry[key as Angle]!} alt={label}
                      onClick={() => onZoom(entry[key as Angle]!)}
                      className="h-full w-full cursor-zoom-in object-cover object-top" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Camera className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {entry?.note && (
            <div className="px-5 pb-5">
              <p className="text-sm leading-relaxed text-muted-foreground">{entry.note}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
  onZoom,
  onReset,
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
  onZoom?: (url: string) => void;
  onReset?: () => void;
}) {
  // Oldest-first for left-to-right slider direction
  const dates = useMemo(() => [...history].reverse().map((e) => e.date), [history]);
  const max = Math.max(0, dates.length - 1);
  const idxA = Math.max(0, dates.indexOf(compareA));
  const idxB = (() => { const i = dates.indexOf(compareB); return i >= 0 ? i : max; })();

  const photoA = compareEntryA?.[compareAngle] ?? null;
  const photoB = compareEntryB?.[compareAngle] ?? null;
  const gap = compareA && compareB ? formatGap(compareA, compareB) : null;


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

        {/* Date selectors */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[{ label: "Date A", value: compareA, onChange: onSetA }, { label: "Date B", value: compareB, onChange: onSetB }].map(({ label, value, onChange }) => (
            <div key={label}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{label}</p>
              <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-9 w-full rounded-xl border border-border bg-background px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {dates.map((d) => (
                  <option key={d} value={d}>{formatDateShort(d)}</option>
                ))}
              </select>
            </div>
          ))}
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

      {/* Avant / Maintenant reset + side-by-side photos */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Comparaison</p>
        {onReset && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <RotateCcw className="h-3 w-3" /> Avant / Maintenant
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CompareSlot label={compareA ? formatDate(compareA) : "Date A"} photo={photoA} side="A" onZoom={onZoom} />
        <CompareSlot label={compareB ? formatDate(compareB) : "Date B"} photo={photoB} side="B" onZoom={onZoom} />
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
  const lo = Math.min(idxA, idxB);
  const hi = Math.max(idxA, idxB);

  return (
    <div>
      <SliderPrimitive.Root
        className="relative flex w-full touch-none select-none items-center h-5"
        min={0}
        max={max}
        step={1}
        value={[lo, hi]}
        onValueChange={([a, b]) => { onChangeA(a); onChangeB(b); }}
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
          <SliderPrimitive.Range className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full bg-primary ring-2 ring-white shadow-md focus-visible:outline-none cursor-grab active:cursor-grabbing" />
        <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full bg-foreground ring-2 ring-white shadow-md focus-visible:outline-none cursor-grab active:cursor-grabbing" />
      </SliderPrimitive.Root>

      {/* Date labels */}
      <div className="relative mt-2 h-4">
        <span
          className="absolute -translate-x-1/2 text-[11px] font-semibold text-primary whitespace-nowrap"
          style={{ left: `${(lo / max) * 100}%` }}
        >
          {dates[lo] ? formatDateShort(dates[lo]) : ""}
        </span>
        <span
          className="absolute -translate-x-1/2 text-[11px] font-medium text-foreground/60 whitespace-nowrap"
          style={{ left: `${(hi / max) * 100}%` }}
        >
          {dates[hi] && lo !== hi ? formatDateShort(dates[hi]) : ""}
        </span>
      </div>
    </div>
  );
}

async function downloadPhoto(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    // silently fail — user can long-press on mobile
  }
}

function CompareSlot({
  label,
  photo,
  side,
  onZoom,
}: {
  label: string;
  photo: string | null;
  side: "A" | "B";
  onZoom?: (url: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-soft text-[11px] font-bold text-primary">
          {side}
        </span>
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground/80">{label}</p>
        {photo && (
          <button
            type="button"
            onClick={() => downloadPhoto(photo, `photo-${side}-${label}.jpg`)}
            className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Télécharger"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="relative aspect-[3/4] bg-muted/30">
        {photo ? (
          <>
            <img
              src={photo}
              alt={label}
              className="h-full w-full object-contain"
            />
            {onZoom && (
              <button
                type="button"
                onClick={() => onZoom(photo)}
                className="sm:hidden absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </button>
            )}
          </>
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

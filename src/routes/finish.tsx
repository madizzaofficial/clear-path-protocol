import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import { Loader2, Trophy, Share2, ArrowLeft, Flame } from "lucide-react";
import { allLessons } from "@/lib/course-data";
import { toast } from "sonner";

export const Route = createFileRoute("/finish")({
  head: () => ({ meta: [{ title: "Protocole terminé — Protocole Clear" }] }),
  component: FinishPage,
});

type PhotoEntry = {
  uid: string;
  date: string;
  front?: string;
  left?: string;
  right?: string;
};

function FinishPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [enrolledAt, setEnrolledAt] = useState<number | null>(null);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [firstPhoto, setFirstPhoto] = useState<PhotoEntry | null>(null);
  const [lastPhoto, setLastPhoto] = useState<PhotoEntry | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getDoc(doc(db, "users", user.uid)),
      getDoc(doc(db, "progress", user.uid)),
      getDocs(query(collection(db, "progress_photos"), where("uid", "==", user.uid))),
    ]).then(([userSnap, progressSnap, photosSnap]) => {
      if (userSnap.exists()) {
        setStreak(userSnap.data().streak ?? 0);
        setEnrolledAt(userSnap.data().enrolledAt ?? null);
      }
      if (progressSnap.exists()) {
        setCompletedLessons(progressSnap.data().completedLessons ?? []);
      }
      const photos = photosSnap.docs
        .map((d) => d.data() as PhotoEntry)
        .sort((a, b) => a.date.localeCompare(b.date));
      if (photos.length > 0) setFirstPhoto(photos[0]);
      if (photos.length > 1) setLastPhoto(photos[photos.length - 1]);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    if (!loading) {
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.55 } });
    }
  }, [loading]);

  if (authLoading || !user) return null;

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const lessons = allLessons();
  const done = completedLessons.length;
  const daysIn = enrolledAt ? Math.max(0, Math.floor((Date.now() - enrolledAt) / 86_400_000)) : null;
  const weeks = daysIn !== null ? Math.ceil((daysIn + 1) / 7) : 12;
  const firstName = user.displayName?.split(" ")[0] ?? user.email?.split("@")[0] ?? "toi";

  async function handleShare() {
    const text = `J'ai terminé le Protocole Clear en ${weeks} semaines — ${done} leçons complétées. Ma peau n'a jamais été aussi bien ! 🌟`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Message copié dans le presse-papiers !");
      }
    } catch {
      // user cancelled share
    }
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-8 md:pt-12">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Retour au dashboard
        </Link>

        {/* Hero */}
        <div className="mb-8 overflow-hidden rounded-3xl bg-gradient-warm p-8 text-center shadow-elegant md:p-12">
          <div className="relative inline-flex h-24 w-24 items-center justify-center rounded-full bg-background/80 shadow-elegant backdrop-blur">
            <Trophy className="h-12 w-12 text-primary" />
          </div>
          <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Félicitations, {firstName} !
          </h1>
          <p className="mt-3 text-base text-foreground/70">
            Tu as terminé le Protocole Clear. 12 semaines de discipline, de constance et de résultats.
          </p>
          <button
            onClick={handleShare}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            <Share2 className="h-4 w-4" /> Partager ma réussite
          </button>
        </div>

        {/* Stats */}
        <div className="mb-8 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
          <div className="border-b border-border/60 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ton bilan
            </p>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-border/60 sm:grid-cols-4 sm:divide-y-0">
            <div className="p-5 text-center">
              <p className="font-display text-3xl font-semibold">{daysIn ?? weeks * 7}</p>
              <p className="mt-1 text-xs text-muted-foreground">Jours de protocole</p>
            </div>
            <div className="p-5 text-center">
              <p className="font-display text-3xl font-semibold">{Math.min(weeks, 12)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Semaines</p>
            </div>
            <div className="p-5 text-center">
              <p className="font-display text-3xl font-semibold">{done}<span className="text-lg font-normal text-muted-foreground">/{lessons.length}</span></p>
              <p className="mt-1 text-xs text-muted-foreground">Leçons</p>
            </div>
            <div className="p-5 text-center">
              <p className="font-display text-3xl font-semibold">
                <Flame className="inline h-6 w-6 text-orange-500" /> {streak}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Jours de suite</p>
            </div>
          </div>
        </div>

        {/* Before / After */}
        {(firstPhoto || lastPhoto) && (
          <div className="mb-8 overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
            <div className="border-b border-border/60 px-6 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Avant / Après
              </p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-border/40">
              {[
                { label: "Avant", entry: firstPhoto },
                { label: "Après", entry: lastPhoto ?? firstPhoto },
              ].map(({ label, entry }) => (
                <div key={label} className="bg-card p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </p>
                  {entry?.front ? (
                    <img
                      src={entry.front}
                      alt={label}
                      className="aspect-square w-full rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground/30 text-xs">
                      Aucune photo
                    </div>
                  )}
                  {entry?.date && (
                    <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Back CTA */}
        <div className="rounded-3xl border border-dashed border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Ton parcours reste accessible dans ton journal et ton profil.
          </p>
          <Link
            to="/journal"
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Revoir mon journal de peau →
          </Link>
        </div>
      </main>
    </AppShell>
  );
}

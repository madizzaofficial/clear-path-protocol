import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { HelpCircle, ChevronDown, Loader2 } from "lucide-react";

type Block = { type: "text" | "image"; value: string };

type FAQEntry = {
  id: string;
  question: string;
  category: string;
  type: "text" | "video" | "image";
  content: string;
  videoUrl: string;
  imageUrl: string;
  blocks: Block[];
  published: boolean;
  order: number;
};

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Protocole Clear" },
      { name: "description", content: "Réponses aux questions fréquentes sur ton protocole." },
    ],
  }),
  component: FaqPage,
});

function getVideoEmbed(url: string): { kind: "video" | "iframe"; src: string } {
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return { kind: "video", src: url };
  const ytWatch = url.match(/youtube\.com\/watch\?.*v=([^&]+)/);
  if (ytWatch) return { kind: "iframe", src: `https://www.youtube.com/embed/${ytWatch[1]}` };
  const ytShort = url.match(/youtu\.be\/([^?]+)/);
  if (ytShort) return { kind: "iframe", src: `https://www.youtube.com/embed/${ytShort[1]}` };
  return { kind: "iframe", src: url };
}

function FaqPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<FAQEntry[]>([]);
  const [faqLoading, setFaqLoading] = useState(true);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    getDocs(collection(db, "faq"))
      .then((snap) => {
        const all = snap.docs
          .map((d) => ({
            id: d.id,
            content: "",
            videoUrl: "",
            imageUrl: "",
            blocks: [],
            ...d.data(),
          } as FAQEntry))
          .filter((e) => e.published)
          .sort((a, b) => a.order - b.order);
        setEntries(all);
      })
      .finally(() => setFaqLoading(false));
  }, [user]);

  if (loading || !user || faqLoading) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const categories: string[] = [];
  const byCategory: Record<string, FAQEntry[]> = {};
  for (const entry of entries) {
    const cat = entry.category || "Général";
    if (!byCategory[cat]) {
      byCategory[cat] = [];
      categories.push(cat);
    }
    byCategory[cat].push(entry);
  }

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <AppShell>
      <main className="pb-24">
        <section className="relative overflow-hidden border-b border-border/60 bg-gradient-warm">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative mx-auto max-w-7xl px-6 py-16 md:py-24">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Questions fréquentes</p>
            <h1 className="mt-4 max-w-2xl font-display text-4xl font-semibold tracking-tight text-balance md:text-6xl">
              FAQ
            </h1>
            <p className="mt-4 max-w-xl text-foreground/70 md:text-lg">
              Les réponses aux questions les plus posées sur ton protocole.
            </p>
          </div>
        </section>

        {entries.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-muted-foreground">
            <HelpCircle className="h-12 w-12 opacity-30" />
            <p className="text-sm">Aucune question disponible pour l'instant.</p>
          </div>
        ) : (
          <section className="mx-auto max-w-3xl px-6 py-12">
            <div className="space-y-10">
              {categories.map((cat) => (
                <div key={cat}>
                  <h2 className="mb-4 font-display text-lg font-semibold text-primary">{cat}</h2>
                  <div className="space-y-3">
                    {byCategory[cat].map((entry) => {
                      const open = openIds.has(entry.id);
                      return (
                        <div key={entry.id} className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft">
                          <button
                            onClick={() => toggle(entry.id)}
                            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-primary-soft/30"
                          >
                            <span className="text-sm font-semibold">{entry.question}</span>
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                            />
                          </button>
                          {open && (
                            <div className="border-t border-border/60 px-5 py-4">
                              <AnswerBody entry={entry} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </AppShell>
  );
}

function AnswerBody({ entry }: { entry: FAQEntry }) {
  if (entry.type === "video" && entry.videoUrl) {
    const embed = getVideoEmbed(entry.videoUrl);
    return (
      <div className="space-y-3">
        {embed.kind === "video" ? (
          <video src={embed.src} controls className="w-full rounded-xl" />
        ) : (
          <div className="relative aspect-video overflow-hidden rounded-xl">
            <iframe
              src={embed.src}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        )}
        {entry.content && <p className="text-sm text-muted-foreground">{entry.content}</p>}
      </div>
    );
  }

  if (entry.type === "image") {
    // New block-based format
    if (entry.blocks && entry.blocks.length > 0) {
      return (
        <div className="space-y-3">
          {entry.blocks.map((block, i) =>
            block.type === "text" ? (
              <p key={i} className="whitespace-pre-wrap text-sm text-foreground/80">{block.value}</p>
            ) : (
              <img key={i} src={block.value} alt="" className="w-full rounded-xl object-cover" />
            )
          )}
        </div>
      );
    }
    // Fallback: old single-image format
    if (entry.imageUrl) {
      return (
        <div className="space-y-3">
          <img src={entry.imageUrl} alt={entry.question} className="w-full rounded-xl object-cover" />
          {entry.content && <p className="text-sm text-muted-foreground">{entry.content}</p>}
        </div>
      );
    }
  }

  return <p className="whitespace-pre-wrap text-sm text-foreground/80">{entry.content}</p>;
}

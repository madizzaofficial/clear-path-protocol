import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, setDoc, deleteDoc, doc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { DndContext, closestCenter, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { GripVertical, Plus, Pencil, Trash2, Loader2, ImageIcon, Video, FileText, HelpCircle, Upload, X } from "lucide-react";
import { uploadProductImageFn } from "@/lib/upload-image";
import { toast } from "sonner";

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
  createdAt: number;
  updatedAt: number;
};

export const Route = createFileRoute("/admin_/faq")({
  head: () => ({
    meta: [{ title: "FAQ — Admin — Protocole Clear" }],
  }),
  component: AdminFaqPage,
});

const TYPE_META = {
  text:  { label: "Texte",  icon: FileText  },
  video: { label: "Vidéo",  icon: Video     },
  image: { label: "Image",  icon: ImageIcon },
} as const;

function AdminFaqPage() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<FAQEntry[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCreatedAt, setEditingCreatedAt] = useState(0);
  const [editingOrder, setEditingOrder] = useState(0);

  // Form fields
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState<"text" | "video" | "image">("text");
  const [content, setContent] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [uploadingBlockIdx, setUploadingBlockIdx] = useState<number | null>(null);
  const blockImageInputRef = useRef<HTMLInputElement>(null);

  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate({ to: "/admin" });
  }, [user, loading, isAdmin, navigate]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    getDocs(collection(db, "faq"))
      .then((snap) => {
        const all = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              question: "",
              category: "",
              type: "text",
              content: "",
              videoUrl: "",
              imageUrl: "",
              blocks: [],
              published: false,
              order: 0,
              createdAt: 0,
              updatedAt: 0,
              ...data,
            } as FAQEntry;
          })
          .sort((a, b) => a.order - b.order);
        setEntries(all);
      })
      .finally(() => setPageLoading(false));
  }, [user, isAdmin]);

  const existingCategories = [...new Set(entries.map((e) => e.category).filter(Boolean))];

  function loadBlocksForEntry(entry: FAQEntry) {
    if (entry.blocks && entry.blocks.length > 0) return entry.blocks;
    // Migrate old single-image entries to block format
    const migrated: Block[] = [];
    if (entry.imageUrl) migrated.push({ type: "image", value: entry.imageUrl });
    if (entry.content) migrated.push({ type: "text", value: entry.content });
    return migrated;
  }

  function openNew() {
    setIsNew(true);
    setEditingId(null);
    setEditingCreatedAt(0);
    setEditingOrder(entries.length);
    setQuestion("");
    setCategory("");
    setType("text");
    setContent("");
    setVideoUrl("");
    setBlocks([]);
    setPublished(false);
    setDialogOpen(true);
  }

  function openEdit(entry: FAQEntry) {
    setIsNew(false);
    setEditingId(entry.id);
    setEditingCreatedAt(entry.createdAt);
    setEditingOrder(entry.order);
    setQuestion(entry.question);
    setCategory(entry.category);
    setType(entry.type);
    setContent(entry.content);
    setVideoUrl(entry.videoUrl);
    setBlocks(loadBlocksForEntry(entry));
    setPublished(entry.published);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!question.trim()) return;
    setSaving(true);
    const now = Date.now();
    const entryData = {
      question: question.trim(),
      category: category.trim() || "Général",
      type,
      content: content.trim(),
      videoUrl: videoUrl.trim(),
      imageUrl: "",
      blocks: type === "image" ? blocks : [],
      published,
      order: editingOrder,
      createdAt: isNew ? now : (editingCreatedAt || now),
      updatedAt: now,
    };
    try {
      if (isNew) {
        const ref = await addDoc(collection(db, "faq"), entryData);
        setEntries((prev) => [...prev, { id: ref.id, ...entryData }]);
        toast.success("Question ajoutée");
      } else {
        await setDoc(doc(db, "faq", editingId!), entryData);
        setEntries((prev) =>
          prev.map((e) => e.id === editingId ? { id: e.id, ...entryData } : e)
        );
        toast.success("Question mise à jour");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "faq", deletingId));
      setEntries((prev) => prev.filter((e) => e.id !== deletingId));
      toast.success("Question supprimée");
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
      setDeletingId(null);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeIdx = entries.findIndex((e) => e.id === active.id);
    const overIdx = entries.findIndex((e) => e.id === over.id);
    const reordered = arrayMove(entries, activeIdx, overIdx).map((e, i) => ({ ...e, order: i }));
    setEntries(reordered);
    await Promise.all(
      reordered.map((e) => setDoc(doc(db, "faq", e.id), { order: e.order }, { merge: true }))
    );
  }

  function addTextBlock() {
    setBlocks((prev) => [...prev, { type: "text", value: "" }]);
  }

  function updateBlock(idx: number, value: string) {
    setBlocks((prev) => prev.map((b, i) => i === idx ? { ...b, value } : b));
  }

  function removeBlock(idx: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleBlockImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const placeholderIdx = blocks.length;
    setBlocks((prev) => [...prev, { type: "image", value: "__uploading__" }]);
    setUploadingBlockIdx(placeholderIdx);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { publicUrl } = await uploadProductImageFn({
        data: { fileName: file.name, contentType: file.type, base64 },
      });
      setBlocks((prev) => prev.map((b, i) => i === placeholderIdx ? { type: "image", value: publicUrl } : b));
      toast.success("Image uploadée");
    } catch {
      setBlocks((prev) => prev.filter((_, i) => i !== placeholderIdx));
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploadingBlockIdx(null);
    }
  }

  if (loading || pageLoading) {
    return (
      <AdminShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {/* Header — wraps on mobile so the button is never cropped */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <HelpCircle className="h-6 w-6 text-primary" />
            <h1 className="font-display text-2xl font-semibold">FAQ</h1>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {entries.length} question{entries.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-80"
          >
            <Plus className="h-4 w-4" /> Nouvelle question
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border/60 text-muted-foreground">
            <HelpCircle className="h-12 w-12 opacity-30" />
            <p className="text-sm">Aucune question. Cliquez sur "Nouvelle question" pour commencer.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {entries.map((entry) => (
                  <SortableRow
                    key={entry.id}
                    entry={entry}
                    onEdit={() => openEdit(entry)}
                    onDelete={() => setDeletingId(entry.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="left-4 right-4 top-4 w-auto translate-x-0 translate-y-0 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl sm:left-[50%] sm:right-auto sm:top-[50%] sm:w-full sm:max-w-2xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:max-h-[90dvh]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {isNew ? "Nouvelle question" : "Modifier la question"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Question */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Question</label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={2}
                placeholder="Quelle quantité de crème mettre ?"
                className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Catégorie</label>
              <input
                list="faq-categories"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="ex: Produits, Routine, Résultats…"
                className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <datalist id="faq-categories">
                {existingCategories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>

            {/* Type selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Type de réponse</label>
              <div className="flex gap-2">
                {(["text", "video", "image"] as const).map((t) => {
                  const { label, icon: Icon } = TYPE_META[t];
                  return (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border py-2.5 text-sm font-medium transition-all ${
                        type === t
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Texte ── */}
            {type === "text" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Réponse</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  placeholder="Tape ta réponse ici…"
                  className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}

            {/* ── Vidéo ── */}
            {type === "video" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">URL de la vidéo</label>
                  <input
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://… (Bunnystream embed, YouTube, Vimeo…)"
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <p className="text-xs text-muted-foreground">
                    Colle l'URL d'embed. Pour YouTube : remplace <code>watch?v=</code> par <code>embed/</code>.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Commentaire sous la vidéo (optionnel)</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                    placeholder="Explications complémentaires, étapes à suivre…"
                    className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            )}

            {/* ── Image — block editor ── */}
            {type === "image" && (
              <div className="space-y-3">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contenu</label>

                {blocks.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-border/60 py-6 text-center text-xs text-muted-foreground">
                    Ajoute des blocs de texte ou d'images ci-dessous
                  </p>
                )}

                <div className="space-y-2">
                  {blocks.map((block, idx) => (
                    <div key={idx} className="relative rounded-2xl border border-border/60 bg-muted/20 p-3">
                      <button
                        onClick={() => removeBlock(idx)}
                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>

                      {block.type === "text" ? (
                        <textarea
                          value={block.value}
                          onChange={(e) => updateBlock(idx, e.target.value)}
                          rows={3}
                          placeholder="Texte…"
                          className="w-full resize-none rounded-xl border-0 bg-transparent pr-8 text-sm outline-none placeholder:text-muted-foreground/60"
                        />
                      ) : block.value === "__uploading__" ? (
                        <div className="flex h-24 items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <img src={block.value} alt="" className="max-h-48 w-full rounded-xl object-cover pr-8" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={addTextBlock}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    <FileText className="h-4 w-4" /> Ajouter du texte
                  </button>
                  <button
                    onClick={() => blockImageInputRef.current?.click()}
                    disabled={uploadingBlockIdx !== null}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
                  >
                    {uploadingBlockIdx !== null ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Ajouter une image
                  </button>
                </div>

                <input
                  ref={blockImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBlockImageChange}
                />
              </div>
            )}

            {/* Published toggle */}
            <div className="flex items-center justify-between rounded-2xl border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Publier</p>
                <p className="text-xs text-muted-foreground">Visible par les élèves</p>
              </div>
              <Switch checked={published} onCheckedChange={setPublished} />
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              onClick={() => setDialogOpen(false)}
              className="w-full rounded-2xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted sm:w-auto"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !question.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:opacity-40 sm:w-auto"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Sauvegarder
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette question ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/80"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}

function SortableRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: FAQEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });
  const { icon: Icon, label } = TYPE_META[entry.type];

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-soft transition-shadow ${isDragging ? "z-10 opacity-80 shadow-elegant" : ""}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{entry.question}</p>
          <p className="text-xs text-muted-foreground">
            {entry.category || "Général"} · {label}
          </p>
        </div>
      </div>

      <span
        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
          entry.published
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {entry.published ? "Publié" : "Brouillon"}
      </span>

      <div className="flex shrink-0 gap-1">
        <button
          onClick={onEdit}
          className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

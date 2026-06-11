import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { course as staticCourse } from "@/lib/course-data";
import { useEffect, useState } from "react";
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
  Plus, Pencil, Trash2, GripVertical,
  ChevronDown, ChevronRight, Video, Lock,
  Loader2, Check, BookOpen, X, UploadCloud, FileText,
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

import { uploadLessonResourceFn as uploadLessonResourceRaw } from "@/lib/upload-image";
import { auth } from "@/lib/firebase";

// Injects the admin's Firebase ID token so the upload server fn can authenticate.
async function uploadLessonResourceFn({ data }: { data: { fileName: string; contentType: string; base64: string } }) {
  const callerToken = await auth.currentUser?.getIdToken();
  if (!callerToken) throw new Error("Session expirée — reconnecte-toi.");
  return uploadLessonResourceRaw({ data: { ...data, callerToken } });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type FirestoreLesson = {
  id: string;
  title: string;
  duration: string;
  summary: string;
  videoUrl: string;
  locked: boolean;
  completed: boolean;
  order: number;
  resources: { name: string; size: string; url?: string }[];
  checklistItems: string[];
  showChecklist: boolean;
  showResources: boolean;
};

type FirestoreChapter = {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: FirestoreLesson[];
};

type FirestoreCourse = {
  title: string;
  subtitle: string;
  estimatedHours: number;
  chapters: FirestoreChapter[];
};

const COURSE_ID = "clear-skin-protocol";
const DRAFT_ID = "clear-skin-protocol_draft";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin_/course-editor")({
  head: () => ({
    meta: [{ title: "Éditeur de cours — Protocole Clear" }],
  }),
  component: CourseEditorPage,
});

// ─── Guard wrapper ────────────────────────────────────────────────────────────

function CourseEditorPage() {
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

  return <CourseEditorContent />;
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function CourseEditorContent() {
  const [course, setCourse] = useState<FirestoreCourse | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAs, setSavedAs] = useState<"draft" | "published" | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  const [editingChapter, setEditingChapter] = useState<FirestoreChapter | null>(null);
  const [isNewChapter, setIsNewChapter] = useState(false);

  const [editingLesson, setEditingLesson] = useState<{ lesson: FirestoreLesson; chapterId: string } | null>(null);
  const [isNewLesson, setIsNewLesson] = useState(false);

  const [deletingChapterId, setDeletingChapterId] = useState<string | null>(null);
  const [deletingLesson, setDeletingLesson] = useState<{ lessonId: string; chapterId: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load: draft first → published → static seed
  useEffect(() => {
    async function load() {
      const draftSnap = await getDoc(doc(db, "courses", DRAFT_ID));
      if (draftSnap.exists()) {
        setCourse(draftSnap.data() as FirestoreCourse);
        setHasDraft(true);
        return;
      }
      const pubSnap = await getDoc(doc(db, "courses", COURSE_ID));
      if (pubSnap.exists()) {
        setCourse(pubSnap.data() as FirestoreCourse);
        return;
      }
      // First-time seed from static data
      setCourse({
        title: staticCourse.title,
        subtitle: staticCourse.subtitle,
        estimatedHours: staticCourse.estimatedHours,
        chapters: staticCourse.chapters.map((ch, i) => ({
          id: ch.id,
          title: ch.title,
          description: ch.description,
          order: i,
          lessons: ch.lessons.map((l, j) => ({
            id: l.id,
            title: l.title,
            duration: l.duration,
            summary: l.summary,
            videoUrl: "",
            locked: l.locked,
            completed: false,
            order: j,
            resources: l.resources,
            checklistItems: [],
            showChecklist: false,
            showResources: false,
          })),
        })),
      });
      setIsDirty(true);
    }
    load();
  }, []);

  // Local-only update — marks dirty without writing to Firestore
  function updateCourse(updated: FirestoreCourse) {
    setCourse(updated);
    setIsDirty(true);
    setSavedAs(null);
  }

  async function saveAsDraft() {
    if (!course) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "courses", DRAFT_ID), course);
      setIsDirty(false);
      setHasDraft(true);
      setSavedAs("draft");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!course) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "courses", COURSE_ID), course);
      await deleteDoc(doc(db, "courses", DRAFT_ID)).catch(() => {});
      setIsDirty(false);
      setHasDraft(false);
      setSavedAs("published");
    } finally {
      setSaving(false);
    }
  }

  function toggleChapter(id: string) {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Chapter drag ──

  function handleChapterDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !course) return;
    const from = course.chapters.findIndex((c) => c.id === active.id);
    const to = course.chapters.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(course.chapters, from, to).map((ch, i) => ({ ...ch, order: i }));
    updateCourse({ ...course, chapters: reordered });
  }

  // ── Lesson drag ──

  function handleLessonDragEnd(chapterId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !course) return;
    const chapter = course.chapters.find((c) => c.id === chapterId);
    if (!chapter) return;
    const from = chapter.lessons.findIndex((l) => l.id === active.id);
    const to = chapter.lessons.findIndex((l) => l.id === over.id);
    const reordered = arrayMove(chapter.lessons, from, to).map((l, i) => ({ ...l, order: i }));
    updateCourse({
      ...course,
      chapters: course.chapters.map((c) =>
        c.id === chapterId ? { ...c, lessons: reordered } : c
      ),
    });
  }

  // ── Chapter CRUD ──

  function handleSaveChapter(data: { title: string; description: string }) {
    if (!course) return;
    let updated: FirestoreCourse;
    if (isNewChapter) {
      const newCh: FirestoreChapter = {
        id: `ch-${Date.now()}`,
        title: data.title,
        description: data.description,
        order: course.chapters.length,
        lessons: [],
      };
      updated = { ...course, chapters: [...course.chapters, newCh] };
    } else {
      updated = {
        ...course,
        chapters: course.chapters.map((ch) =>
          ch.id === editingChapter?.id ? { ...ch, ...data } : ch
        ),
      };
    }
    updateCourse(updated);
    setEditingChapter(null);
  }

  function handleDeleteChapter() {
    if (!course || !deletingChapterId) return;
    updateCourse({ ...course, chapters: course.chapters.filter((ch) => ch.id !== deletingChapterId) });
    setDeletingChapterId(null);
  }

  // ── Lesson CRUD ──

  function handleSaveLesson(data: Partial<FirestoreLesson>) {
    if (!course || !editingLesson) return;
    let updated: FirestoreCourse;
    if (isNewLesson) {
      const newL: FirestoreLesson = {
        id: `l-${Date.now()}`,
        title: data.title ?? "Nouvelle leçon",
        duration: data.duration ?? "5 min",
        summary: data.summary ?? "",
        videoUrl: data.videoUrl ?? "",
        locked: data.locked ?? false,
        completed: false,
        order: 0,
        resources: data.resources ?? [],
        checklistItems: data.checklistItems ?? [],
        showChecklist: data.showChecklist ?? false,
        showResources: data.showResources ?? false,
      };
      updated = {
        ...course,
        chapters: course.chapters.map((ch) =>
          ch.id === editingLesson.chapterId
            ? { ...ch, lessons: [...ch.lessons, { ...newL, order: ch.lessons.length }] }
            : ch
        ),
      };
    } else {
      updated = {
        ...course,
        chapters: course.chapters.map((ch) =>
          ch.id === editingLesson.chapterId
            ? { ...ch, lessons: ch.lessons.map((l) => l.id === editingLesson.lesson.id ? { ...l, ...data } : l) }
            : ch
        ),
      };
    }
    updateCourse(updated);
    setEditingLesson(null);
  }

  function handleDeleteLesson() {
    if (!course || !deletingLesson) return;
    updateCourse({
      ...course,
      chapters: course.chapters.map((ch) =>
        ch.id === deletingLesson.chapterId
          ? { ...ch, lessons: ch.lessons.filter((l) => l.id !== deletingLesson.lessonId) }
          : ch
      ),
    });
    setDeletingLesson(null);
  }

  // ── Render ──

  if (!course) {
    return (
      <AdminShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminShell>
    );
  }

  const totalLessons = course.chapters.reduce((s, c) => s + c.lessons.length, 0);

  return (
    <AdminShell>
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:pt-12">
        {/* Header */}
        <header className="mb-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Admin</p>
              <div className="mt-3 flex items-center gap-3">
                <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">Éditeur de cours</h1>
                {hasDraft && !isDirty && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                    Brouillon
                  </span>
                )}
                {isDirty && (
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                    Modifications non sauvegardées
                  </span>
                )}
              </div>
              <p className="mt-2 text-muted-foreground">
                {course.chapters.length} chapitre{course.chapters.length !== 1 ? "s" : ""} · {totalLessons} leçon{totalLessons !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="flex items-center gap-3 text-sm">
              {saving && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sauvegarde…
                </span>
              )}
              {!saving && savedAs === "draft" && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Check className="h-3.5 w-3.5 text-amber-500" /> Brouillon sauvegardé
                </span>
              )}
              {!saving && savedAs === "published" && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Check className="h-3.5 w-3.5 text-primary" /> Publié
                </span>
              )}
              <button
                onClick={saveAsDraft}
                disabled={saving || !isDirty}
                className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-amber-400/60 hover:bg-amber-50/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-amber-950/20"
              >
                Sauvegarder comme brouillon
              </button>
              <button
                onClick={publish}
                disabled={saving || (!isDirty && !hasDraft)}
                className="flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Publier
              </button>
            </div>
          </div>
        </header>

        {/* Course metadata */}
        <div className="mb-8 overflow-hidden rounded-3xl border border-border/60 bg-card p-6 shadow-soft md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-semibold">{course.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{course.subtitle}</p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {course.estimatedHours}h total
            </span>
          </div>
        </div>

        {/* Chapters — sortable */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleChapterDragEnd}
        >
          <SortableContext
            items={course.chapters.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {course.chapters.map((ch, chIdx) => (
                <SortableChapter
                  key={ch.id}
                  ch={ch}
                  chIdx={chIdx}
                  isOpen={expandedChapters.has(ch.id)}
                  sensors={sensors}
                  onToggle={() => toggleChapter(ch.id)}
                  onEditChapter={() => { setEditingChapter(ch); setIsNewChapter(false); }}
                  onDeleteChapter={() => setDeletingChapterId(ch.id)}
                  onAddLesson={() => {
                    setEditingLesson({
                      lesson: { id: "", title: "", duration: "5 min", summary: "", videoUrl: "", locked: false, completed: false, order: ch.lessons.length, resources: [], checklistItems: [], showChecklist: false, showResources: false },
                      chapterId: ch.id,
                    });
                    setIsNewLesson(true);
                  }}
                  onEditLesson={(l) => { setEditingLesson({ lesson: l, chapterId: ch.id }); setIsNewLesson(false); }}
                  onDeleteLesson={(lessonId) => setDeletingLesson({ lessonId, chapterId: ch.id })}
                  onLessonDragEnd={(event) => handleLessonDragEnd(ch.id, event)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Add chapter */}
        <div className="mt-5">
          <button
            onClick={() => {
              setEditingChapter({ id: "", title: "", description: "", order: course.chapters.length, lessons: [] });
              setIsNewChapter(true);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-border bg-card py-5 text-sm font-medium text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary-soft/20 hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Ajouter un chapitre
          </button>
        </div>
      </main>

      {/* ── Dialogs ── */}

      <ChapterDialog
        chapter={editingChapter}
        isNew={isNewChapter}
        onClose={() => setEditingChapter(null)}
        onSave={handleSaveChapter}
      />

      <LessonDialog
        data={editingLesson}
        isNew={isNewLesson}
        onClose={() => setEditingLesson(null)}
        onSave={handleSaveLesson}
      />

      <AlertDialog open={!!deletingChapterId} onOpenChange={(o) => !o && setDeletingChapterId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Supprimer ce chapitre ?</AlertDialogTitle>
            <AlertDialogDescription>
              Toutes les leçons de ce chapitre seront également supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChapter}
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingLesson} onOpenChange={(o) => !o && setDeletingLesson(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Supprimer cette leçon ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette leçon sera définitivement supprimée du cours.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLesson}
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}

// ─── Sortable Chapter ─────────────────────────────────────────────────────────

function SortableChapter({
  ch, chIdx, isOpen, sensors, onToggle,
  onEditChapter, onDeleteChapter, onAddLesson,
  onEditLesson, onDeleteLesson, onLessonDragEnd,
}: {
  ch: FirestoreChapter;
  chIdx: number;
  isOpen: boolean;
  sensors: ReturnType<typeof useSensors>;
  onToggle: () => void;
  onEditChapter: () => void;
  onDeleteChapter: () => void;
  onAddLesson: () => void;
  onEditLesson: (l: FirestoreLesson) => void;
  onDeleteLesson: (lessonId: string) => void;
  onLessonDragEnd: (event: DragEndEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ch.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <article ref={setNodeRef} style={style} className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
      <div className="flex items-center gap-2 p-5 md:p-6">
        <button
          {...attributes} {...listeners}
          className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-xl text-muted-foreground/30 transition-colors hover:text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-5 w-5" />
        </button>
        <button onClick={onToggle} className="flex flex-1 items-start gap-4 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-sm font-semibold text-primary">
            {chIdx + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-lg font-semibold leading-tight">{ch.title}</h3>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                {ch.lessons.length} leçon{ch.lessons.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{ch.description}</p>
          </div>
          <span className="mt-1 shrink-0 text-muted-foreground">
            {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={onEditChapter} className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onDeleteChapter} className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/60">
              {ch.lessons.length === 0 && (
                <p className="px-6 py-5 text-sm text-muted-foreground md:px-8">Aucune leçon — ajoutez-en une ci-dessous.</p>
              )}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onLessonDragEnd}>
                <SortableContext items={ch.lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                  <ul className="divide-y divide-border/40">
                    {ch.lessons.map((l, lIdx) => (
                      <SortableLesson key={l.id} l={l} lIdx={lIdx} onEdit={() => onEditLesson(l)} onDelete={() => onDeleteLesson(l.id)} />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
              <div className="border-t border-border/40 p-4 md:px-8">
                <button
                  onClick={onAddLesson}
                  className="flex items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft/30 hover:text-foreground"
                >
                  <Plus className="h-4 w-4" /> Ajouter une leçon
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

// ─── Sortable Lesson ──────────────────────────────────────────────────────────

function SortableLesson({ l, lIdx, onEdit, onDelete }: {
  l: FirestoreLesson; lIdx: number; onEdit: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: l.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-3 px-5 py-4 md:px-8">
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground/30 transition-colors hover:text-muted-foreground/60 active:cursor-grabbing">
        <GripVertical className="h-4 w-4 shrink-0" />
      </button>
      <span className="w-5 shrink-0 text-center text-xs font-medium tabular-nums text-muted-foreground">{lIdx + 1}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{l.title}</p>
          {l.locked && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        </div>
        <div className="mt-0.5 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{l.duration}</span>
          {l.videoUrl
            ? <span className="flex items-center gap-1 text-xs text-primary"><Video className="h-3 w-3" /> Vidéo définie</span>
            : <span className="text-xs text-muted-foreground/50">Pas de vidéo</span>
          }
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button onClick={onEdit} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDelete} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

// ─── Chapter Dialog ───────────────────────────────────────────────────────────

function ChapterDialog({ chapter, isNew, onClose, onSave }: {
  chapter: FirestoreChapter | null;
  isNew: boolean;
  onClose: () => void;
  onSave: (d: { title: string; description: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (chapter) { setTitle(chapter.title); setDescription(chapter.description); }
  }, [chapter]);

  return (
    <Dialog open={!!chapter} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {isNew ? "Ajouter un chapitre" : "Modifier le chapitre"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">Titre</label>
            <input autoComplete="off" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du chapitre"
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">Description</label>
            <textarea autoComplete="off" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Courte description du chapitre" rows={3}
              className="w-full resize-none rounded-2xl border border-border bg-background p-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <button onClick={onClose} className="rounded-2xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted">Annuler</button>
          <button onClick={() => onSave({ title, description })} disabled={!title.trim()}
            className="rounded-2xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50">
            {isNew ? "Ajouter" : "Appliquer"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lesson Dialog ────────────────────────────────────────────────────────────

function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative ml-4 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${value ? "bg-primary" : "bg-muted"}`}>
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function LessonDialog({ data, isNew, onClose, onSave }: {
  data: { lesson: FirestoreLesson; chapterId: string } | null;
  isNew: boolean;
  onClose: () => void;
  onSave: (d: Partial<FirestoreLesson>) => void;
}) {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("5 min");
  const [summary, setSummary] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [locked, setLocked] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [showResources, setShowResources] = useState(false);
  const [resources, setResources] = useState<{ _key: string; name: string; size: string; url: string; uploading?: boolean }[]>([]);

  useEffect(() => {
    if (data?.lesson) {
      setTitle(data.lesson.title);
      setDuration(data.lesson.duration);
      setSummary(data.lesson.summary);
      setVideoUrl(data.lesson.videoUrl);
      setLocked(data.lesson.locked);
      setShowChecklist(data.lesson.showChecklist ?? false);
      setChecklistItems(data.lesson.checklistItems ?? []);
      setShowResources(data.lesson.showResources ?? false);
      setResources((data.lesson.resources ?? []).map((r) => ({ _key: r.url || r.name, name: r.name, size: r.size, url: r.url ?? "" })));
    }
  }, [data]);

  function handleSave() {
    onSave({
      title, duration, summary, videoUrl, locked,
      showChecklist,
      checklistItems: showChecklist ? checklistItems.filter((i) => i.trim()) : [],
      showResources,
      resources: showResources ? resources.filter((r) => r.name.trim() && !r.uploading).map(({ _key: _k, uploading: _u, ...r }) => r) : [],
    });
  }

  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {isNew ? "Ajouter une leçon" : "Modifier la leçon"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">Titre</label>
            <input autoComplete="off" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de la leçon"
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">Durée</label>
            <input autoComplete="off" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="ex : 9 min"
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">URL vidéo</label>
            <div className="relative">
              <Video className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input autoComplete="off" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…"
                className="h-11 w-full rounded-2xl border border-border bg-background pl-11 pr-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">YouTube, Vimeo, MP4 direct ou lien Bunnystream</p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">Résumé</label>
            <textarea autoComplete="off" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Ce que l'élève apprendra" rows={3}
              className="w-full resize-none rounded-2xl border border-border bg-background p-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </div>

          {/* Verrouiller */}
          <div className="flex items-center justify-between rounded-2xl border border-border bg-background p-4">
            <div>
              <p className="text-sm font-medium">Verrouiller la leçon</p>
              <p className="text-xs text-muted-foreground">Nécessite de compléter les leçons précédentes</p>
            </div>
            <ToggleSwitch value={locked} onChange={setLocked} />
          </div>

          {/* Liste de contrôle */}
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Liste de contrôle</p>
                <p className="text-xs text-muted-foreground">Points à cocher par l'élève après la leçon</p>
              </div>
              <ToggleSwitch value={showChecklist} onChange={setShowChecklist} />
            </div>
            {showChecklist && (
              <div className="mt-4 space-y-2">
                {checklistItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      autoComplete="off"
                      value={item}
                      onChange={(e) => setChecklistItems((prev) => prev.map((v, idx) => idx === i ? e.target.value : v))}
                      placeholder={`Étape ${i + 1}`}
                      className="h-9 flex-1 rounded-xl border border-border bg-muted/40 px-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <button type="button" onClick={() => setChecklistItems((prev) => prev.filter((_, idx) => idx !== i))}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => setChecklistItems((prev) => [...prev, ""])}
                  className="flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                  <Plus className="h-3.5 w-3.5" /> Ajouter une étape
                </button>
              </div>
            )}
          </div>

          {/* Ressources */}
          <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Ressources</p>
                <p className="text-xs text-muted-foreground">Fichiers téléchargeables (PDF, images…)</p>
              </div>
              <ToggleSwitch value={showResources} onChange={setShowResources} />
            </div>
            {showResources && (
              <div className="mt-4 space-y-2">
                {resources.map((r) => (
                  <div key={r._key} className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
                    {r.uploading ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.name || "Fichier"}</p>
                      {r.size && <p className="text-xs text-muted-foreground">{r.uploading ? "Envoi en cours…" : r.size}</p>}
                    </div>
                    {!r.uploading && (
                      <button type="button" onClick={() => setResources((prev) => prev.filter((v) => v._key !== r._key))}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
                  <UploadCloud className="h-3.5 w-3.5" /> Ajouter un fichier
                  <input type="file" className="sr-only" accept="*/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      e.target.value = "";
                      const sizeStr = file.size < 1024 * 1024
                        ? `${(file.size / 1024).toFixed(0)} KB`
                        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
                      const key = `${Date.now()}-${Math.random()}`;
                      setResources((prev) => [...prev, { _key: key, name: file.name, size: sizeStr, url: "", uploading: true }]);
                      try {
                        const base64 = await new Promise<string>((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve((reader.result as string).split(",")[1]);
                          reader.onerror = reject;
                          reader.readAsDataURL(file);
                        });
                        const { publicUrl } = await uploadLessonResourceFn({ data: { fileName: file.name, contentType: file.type || "application/octet-stream", base64 } });
                        setResources((prev) => prev.map((v) => v._key === key ? { ...v, url: publicUrl, uploading: false } : v));
                      } catch {
                        setResources((prev) => prev.filter((v) => v._key !== key));
                      }
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <button onClick={onClose} className="rounded-2xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted">Annuler</button>
          <button onClick={handleSave} disabled={!title.trim()}
            className="rounded-2xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50">
            {isNew ? "Ajouter" : "Appliquer"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

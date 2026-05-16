import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
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
  Loader2, Check, BookOpen,
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

type FirestoreLesson = {
  id: string;
  title: string;
  duration: string;
  summary: string;
  videoUrl: string;
  locked: boolean;
  completed: boolean;
  order: number;
  resources: { name: string; size: string }[];
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
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
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

  // Load from Firestore, seed from static data if absent
  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, "courses", COURSE_ID));
      if (snap.exists()) {
        setCourse(snap.data() as FirestoreCourse);
      } else {
        const seeded: FirestoreCourse = {
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
            })),
          })),
        };
        setCourse(seeded);
      }
    }
    load();
  }, []);

  async function saveCourse(updated: FirestoreCourse) {
    setSaving(true);
    try {
      await setDoc(doc(db, "courses", COURSE_ID), updated);
      setCourse(updated);
      setSavedAt(new Date());
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
    saveCourse({ ...course, chapters: reordered });
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
    saveCourse({
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
    saveCourse(updated);
    setEditingChapter(null);
  }

  function handleDeleteChapter() {
    if (!course || !deletingChapterId) return;
    saveCourse({ ...course, chapters: course.chapters.filter((ch) => ch.id !== deletingChapterId) });
    setDeletingChapterId(null);
  }

  // ── Lesson CRUD ──

  function handleSaveLesson(data: Partial<FirestoreLesson>) {
    if (!course || !editingLesson) return;
    let updated: FirestoreCourse;
    if (isNewLesson) {
      const newL: FirestoreLesson = {
        id: `l-${Date.now()}`,
        title: data.title ?? "New Lesson",
        duration: data.duration ?? "5 min",
        summary: data.summary ?? "",
        videoUrl: data.videoUrl ?? "",
        locked: data.locked ?? false,
        completed: false,
        order: 0,
        resources: [],
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
    saveCourse(updated);
    setEditingLesson(null);
  }

  function handleDeleteLesson() {
    if (!course || !deletingLesson) return;
    saveCourse({
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
              <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">Course Editor</h1>
              <p className="mt-2 text-muted-foreground">
                {course.chapters.length} chapters · {totalLessons} lessons
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {saving && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                </span>
              )}
              {!saving && savedAt && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  Saved {savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
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
                      lesson: { id: "", title: "", duration: "5 min", summary: "", videoUrl: "", locked: false, completed: false, order: ch.lessons.length, resources: [] },
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
            <Plus className="h-4 w-4" /> Add chapter
          </button>
        </div>
      </main>

      {/* ── Dialogs ── */}

      <ChapterDialog
        chapter={editingChapter}
        isNew={isNewChapter}
        onClose={() => setEditingChapter(null)}
        onSave={handleSaveChapter}
        saving={saving}
      />

      <LessonDialog
        data={editingLesson}
        isNew={isNewLesson}
        onClose={() => setEditingLesson(null)}
        onSave={handleSaveLesson}
        saving={saving}
      />

      <AlertDialog open={!!deletingChapterId} onOpenChange={(o) => !o && setDeletingChapterId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete this chapter?</AlertDialogTitle>
            <AlertDialogDescription>
              All lessons inside this chapter will also be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChapter}
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete chapter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingLesson} onOpenChange={(o) => !o && setDeletingLesson(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete this lesson?</AlertDialogTitle>
            <AlertDialogDescription>
              This lesson will be permanently removed from the course.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLesson}
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete lesson
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}

// ─── Sortable Chapter ─────────────────────────────────────────────────────────

function SortableChapter({
  ch,
  chIdx,
  isOpen,
  sensors,
  onToggle,
  onEditChapter,
  onDeleteChapter,
  onAddLesson,
  onEditLesson,
  onDeleteLesson,
  onLessonDragEnd,
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ch.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft"
    >
      {/* Chapter header row */}
      <div className="flex items-center gap-2 p-5 md:p-6">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-xl text-muted-foreground/30 transition-colors hover:text-muted-foreground active:cursor-grabbing"
          title="Drag to reorder chapter"
        >
          <GripVertical className="h-5 w-5" />
        </button>

        {/* Expand toggle */}
        <button
          onClick={onToggle}
          className="flex flex-1 items-start gap-4 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-sm font-semibold text-primary">
            {chIdx + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-lg font-semibold leading-tight">{ch.title}</h3>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                {ch.lessons.length} lesson{ch.lessons.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{ch.description}</p>
          </div>
          <span className="mt-1 shrink-0 text-muted-foreground">
            {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </span>
        </button>

        {/* Chapter actions */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={onEditChapter}
            title="Edit chapter"
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDeleteChapter}
            title="Delete chapter"
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Lessons list — accordion */}
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
                <p className="px-6 py-5 text-sm text-muted-foreground md:px-8">
                  No lessons yet — add your first one below.
                </p>
              )}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onLessonDragEnd}
              >
                <SortableContext
                  items={ch.lessons.map((l) => l.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="divide-y divide-border/40">
                    {ch.lessons.map((l, lIdx) => (
                      <SortableLesson
                        key={l.id}
                        l={l}
                        lIdx={lIdx}
                        onEdit={() => onEditLesson(l)}
                        onDelete={() => onDeleteLesson(l.id)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>

              {/* Add lesson */}
              <div className="border-t border-border/40 p-4 md:px-8">
                <button
                  onClick={onAddLesson}
                  className="flex items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft/30 hover:text-foreground"
                >
                  <Plus className="h-4 w-4" /> Add lesson
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

function SortableLesson({
  l,
  lIdx,
  onEdit,
  onDelete,
}: {
  l: FirestoreLesson;
  lIdx: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: l.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-3 px-5 py-4 md:px-8">
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground/30 transition-colors hover:text-muted-foreground/60 active:cursor-grabbing"
        title="Drag to reorder lesson"
      >
        <GripVertical className="h-4 w-4 shrink-0" />
      </button>
      <span className="w-5 shrink-0 text-center text-xs font-medium tabular-nums text-muted-foreground">
        {lIdx + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{l.title}</p>
          {l.locked && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        </div>
        <div className="mt-0.5 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{l.duration}</span>
          {l.videoUrl ? (
            <span className="flex items-center gap-1 text-xs text-primary">
              <Video className="h-3 w-3" /> Video set
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/50">No video</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={onEdit}
          title="Edit lesson"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          title="Delete lesson"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

// ─── Chapter Dialog ───────────────────────────────────────────────────────────

function ChapterDialog({
  chapter,
  isNew,
  onClose,
  onSave,
  saving,
}: {
  chapter: FirestoreChapter | null;
  isNew: boolean;
  onClose: () => void;
  onSave: (d: { title: string; description: string }) => void;
  saving: boolean;
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
            {isNew ? "Add chapter" : "Edit chapter"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">Title</label>
            <input

              autoComplete="off"              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Chapter title"
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">Description</label>
            <textarea

              autoComplete="off"              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this chapter"
              rows={3}
              className="w-full resize-none rounded-2xl border border-border bg-background p-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <button
            onClick={onClose}
            className="rounded-2xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ title, description })}
            disabled={saving || !title.trim()}
            className="flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isNew ? "Add chapter" : "Save changes"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Lesson Dialog ────────────────────────────────────────────────────────────

function LessonDialog({
  data,
  isNew,
  onClose,
  onSave,
  saving,
}: {
  data: { lesson: FirestoreLesson; chapterId: string } | null;
  isNew: boolean;
  onClose: () => void;
  onSave: (d: Partial<FirestoreLesson>) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("5 min");
  const [summary, setSummary] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (data?.lesson) {
      setTitle(data.lesson.title);
      setDuration(data.lesson.duration);
      setSummary(data.lesson.summary);
      setVideoUrl(data.lesson.videoUrl);
      setLocked(data.lesson.locked);
    }
  }, [data]);

  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {isNew ? "Add lesson" : "Edit lesson"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">Title</label>
            <input

              autoComplete="off"              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lesson title"
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">Duration</label>
            <input

              autoComplete="off"              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 9 min"
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">Video URL</label>
            <div className="relative">
              <Video className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input

                autoComplete="off"                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                className="h-11 w-full rounded-2xl border border-border bg-background pl-11 pr-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">YouTube, Vimeo, or direct MP4 URL</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground/80">Summary</label>
            <textarea

              autoComplete="off"              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="What students will learn in this lesson"
              rows={3}
              className="w-full resize-none rounded-2xl border border-border bg-background p-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Lock toggle */}
          <div className="flex items-center justify-between rounded-2xl border border-border bg-background p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Lock lesson</p>
              <p className="text-xs text-muted-foreground">Requires previous lessons to be completed first</p>
            </div>
            <button
              type="button"
              onClick={() => setLocked((v) => !v)}
              className={`relative ml-4 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${locked ? "bg-primary" : "bg-muted"}`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${locked ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            onClick={onClose}
            className="rounded-2xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ title, duration, summary, videoUrl, locked })}
            disabled={saving || !title.trim()}
            className="flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isNew ? "Add lesson" : "Save changes"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

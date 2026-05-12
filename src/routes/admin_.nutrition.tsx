import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Loader2, Save, GripVertical } from "lucide-react";
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

// ─── Types ────────────────────────────────────────────────────────────────────

type NutritionItem = { id: string; label: string; emoji: string };
type Reminder = { id: string; text: string; emoji: string };

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin_/nutrition")({
  head: () => ({ meta: [{ title: "Nutrition — Admin Protocole Clear" }] }),
  component: NutritionPage,
});

function NutritionPage() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
    if (!loading && user && !isAdmin) navigate({ to: "/admin" });
  }, [user, loading, isAdmin, navigate]);

  if (loading || !user || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <NutritionContent />;
}

// ─── Main content ─────────────────────────────────────────────────────────────

function NutritionContent() {
  const [nutritionItems, setNutritionItems] = useState<NutritionItem[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [savingNutrition, setSavingNutrition] = useState(false);
  const [savingReminders, setSavingReminders] = useState(false);

  const [newNutritionEmoji, setNewNutritionEmoji] = useState("🥗");
  const [newNutritionLabel, setNewNutritionLabel] = useState("");
  const [newReminderEmoji, setNewReminderEmoji] = useState("💡");
  const [newReminderText, setNewReminderText] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    async function load() {
      setLoadingData(true);
      const [nutritionSnap, remindersSnap] = await Promise.all([
        getDoc(doc(db, "config", "nutrition")),
        getDoc(doc(db, "config", "reminders")),
      ]);
      if (nutritionSnap.exists()) setNutritionItems(nutritionSnap.data().items ?? []);
      if (remindersSnap.exists()) setReminders(remindersSnap.data().items ?? []);
      setLoadingData(false);
    }
    load();
  }, []);

  async function saveNutrition(items: NutritionItem[]) {
    setSavingNutrition(true);
    await setDoc(doc(db, "config", "nutrition"), { items });
    setSavingNutrition(false);
  }

  async function saveReminders(items: Reminder[]) {
    setSavingReminders(true);
    await setDoc(doc(db, "config", "reminders"), { items });
    setSavingReminders(false);
  }

  function addNutritionItem() {
    if (!newNutritionLabel.trim()) return;
    const updated = [...nutritionItems, { id: `n-${Date.now()}`, label: newNutritionLabel.trim(), emoji: newNutritionEmoji }];
    setNutritionItems(updated);
    saveNutrition(updated);
    setNewNutritionLabel("");
  }

  function removeNutritionItem(id: string) {
    const updated = nutritionItems.filter((i) => i.id !== id);
    setNutritionItems(updated);
    saveNutrition(updated);
  }

  function handleNutritionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = nutritionItems.findIndex((i) => i.id === active.id);
    const to = nutritionItems.findIndex((i) => i.id === over.id);
    const updated = arrayMove(nutritionItems, from, to);
    setNutritionItems(updated);
    saveNutrition(updated);
  }

  function addReminder() {
    if (!newReminderText.trim()) return;
    const updated = [...reminders, { id: `r-${Date.now()}`, text: newReminderText.trim(), emoji: newReminderEmoji }];
    setReminders(updated);
    saveReminders(updated);
    setNewReminderText("");
  }

  function removeReminder(id: string) {
    const updated = reminders.filter((r) => r.id !== id);
    setReminders(updated);
    saveReminders(updated);
  }

  function handleRemindersDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = reminders.findIndex((r) => r.id === active.id);
    const to = reminders.findIndex((r) => r.id === over.id);
    const updated = arrayMove(reminders, from, to);
    setReminders(updated);
    saveReminders(updated);
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8 md:pt-12">
        <div className="mb-8">
          <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Retour au dashboard
          </Link>
        </div>

        <header className="mb-10">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Admin</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">Nutrition & Rappels</h1>
          <p className="mt-2 text-muted-foreground">Configurez la checklist nutrition et les rappels affichés à tous les élèves.</p>
        </header>

        {loadingData ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-8">

            {/* ── Checklist nutrition ─────────────────────────────────────── */}
            <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
              <div className="flex items-center justify-between border-b border-border/60 px-6 py-5">
                <div>
                  <h2 className="font-display text-xl font-semibold">Checklist nutrition</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">Les élèves cochent ces items chaque jour depuis leur dashboard.</p>
                </div>
                {savingNutrition && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {!savingNutrition && nutritionItems.length > 0 && <Save className="h-4 w-4 text-primary" />}
              </div>

              {nutritionItems.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleNutritionDragEnd}>
                  <SortableContext items={nutritionItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <ul className="divide-y divide-border/40">
                      {nutritionItems.map((item) => (
                        <SortableNutritionItem key={item.id} item={item} onRemove={() => removeNutritionItem(item.id)} />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              )}

              <div className="p-5">
                <div className="flex gap-2">
                  <input
                    value={newNutritionEmoji}
                    onChange={(e) => setNewNutritionEmoji(e.target.value)}
                    placeholder="🥗"
                    className="h-11 w-14 rounded-2xl border border-border bg-background px-3 text-center text-lg outline-none focus:border-primary"
                  />
                  <input
                    value={newNutritionLabel}
                    onChange={(e) => setNewNutritionLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addNutritionItem()}
                    placeholder="ex. Boire 1.5L d'eau"
                    className="h-11 flex-1 rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    onClick={addNutritionItem}
                    disabled={!newNutritionLabel.trim()}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>

            {/* ── Rappels généraux ────────────────────────────────────────── */}
            <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
              <div className="flex items-center justify-between border-b border-border/60 px-6 py-5">
                <div>
                  <h2 className="font-display text-xl font-semibold">Rappels généraux</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">Conseils persistants affichés dans le dashboard (non cochables).</p>
                </div>
                {savingReminders && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {!savingReminders && reminders.length > 0 && <Save className="h-4 w-4 text-primary" />}
              </div>

              {reminders.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRemindersDragEnd}>
                  <SortableContext items={reminders.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                    <ul className="divide-y divide-border/40">
                      {reminders.map((r) => (
                        <SortableReminderItem key={r.id} reminder={r} onRemove={() => removeReminder(r.id)} />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              )}

              <div className="p-5">
                <div className="flex gap-2">
                  <input
                    value={newReminderEmoji}
                    onChange={(e) => setNewReminderEmoji(e.target.value)}
                    placeholder="💡"
                    className="h-11 w-14 rounded-2xl border border-border bg-background px-3 text-center text-lg outline-none focus:border-primary"
                  />
                  <input
                    value={newReminderText}
                    onChange={(e) => setNewReminderText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addReminder()}
                    placeholder="ex. Éviter les produits laitiers"
                    className="h-11 flex-1 rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    onClick={addReminder}
                    disabled={!newReminderText.trim()}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>

          </div>
        )}
      </main>
    </AppShell>
  );
}

// ─── Sortable items ───────────────────────────────────────────────────────────

function SortableNutritionItem({ item, onRemove }: { item: NutritionItem; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : undefined }}
      className="flex items-center gap-3 px-5 py-3.5"
    >
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground/30 hover:text-muted-foreground/60 active:cursor-grabbing">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-base">{item.emoji}</span>
      <span className="flex-1 text-sm">{item.label}</span>
      <button onClick={onRemove} className="flex h-7 w-7 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function SortableReminderItem({ reminder, onRemove }: { reminder: Reminder; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: reminder.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : undefined }}
      className="flex items-center gap-3 px-5 py-3.5"
    >
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground/30 hover:text-muted-foreground/60 active:cursor-grabbing">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-base">{reminder.emoji}</span>
      <span className="flex-1 text-sm">{reminder.text}</span>
      <button onClick={onRemove} className="flex h-7 w-7 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

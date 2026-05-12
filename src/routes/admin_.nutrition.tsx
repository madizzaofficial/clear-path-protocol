import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Plus, Trash2, Loader2, GripVertical, Users, ChevronRight,
} from "lucide-react";
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

type UserDoc = { uid: string; email: string; displayName: string | null };
type NutritionItem = { id: string; label: string; emoji: string };
type Reminder = { id: string; text: string; emoji: string };

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin_/nutrition")({
  validateSearch: (search: Record<string, unknown>) => ({
    uid: typeof search.uid === "string" ? search.uid : "",
  }),
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
  const { uid: preselectedUid } = Route.useSearch();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDoc | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Per-student nutrition items
  const [nutritionItems, setNutritionItems] = useState<NutritionItem[]>([]);
  const [loadingNutrition, setLoadingNutrition] = useState(false);
  const [savingNutrition, setSavingNutrition] = useState(false);
  const [newEmoji, setNewEmoji] = useState("🥗");
  const [newLabel, setNewLabel] = useState("");

  // Global reminders
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loadingReminders, setLoadingReminders] = useState(true);
  const [savingReminders, setSavingReminders] = useState(false);
  const [newReminderEmoji, setNewReminderEmoji] = useState("💡");
  const [newReminderText, setNewReminderText] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load students + global reminders on mount
  useEffect(() => {
    async function load() {
      const [usersSnap, remindersSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDoc(doc(db, "config", "reminders")),
      ]);
      const fetched = usersSnap.docs.map((d) => d.data() as UserDoc);
      setUsers(fetched);
      setLoadingUsers(false);

      if (preselectedUid) {
        const match = fetched.find((u) => u.uid === preselectedUid);
        if (match) selectUser(match);
      }
      if (remindersSnap.exists()) setReminders(remindersSnap.data().items ?? []);
      setLoadingReminders(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedUid]);

  async function selectUser(u: UserDoc) {
    setSelectedUser(u);
    setNutritionItems([]);
    setNewLabel("");
    setLoadingNutrition(true);
    const snap = await getDoc(doc(db, "nutrition", u.uid));
    if (snap.exists()) setNutritionItems(snap.data().items ?? []);
    setLoadingNutrition(false);
  }

  // ── Per-student nutrition ──────────────────────────────────────────────────

  async function saveNutrition(items: NutritionItem[]) {
    if (!selectedUser) return;
    setSavingNutrition(true);
    await setDoc(doc(db, "nutrition", selectedUser.uid), { items });
    setSavingNutrition(false);
  }

  function addItem() {
    if (!newLabel.trim()) return;
    const updated = [...nutritionItems, { id: `n-${Date.now()}`, label: newLabel.trim(), emoji: newEmoji }];
    setNutritionItems(updated);
    saveNutrition(updated);
    setNewLabel("");
  }

  function removeItem(id: string) {
    const updated = nutritionItems.filter((i) => i.id !== id);
    setNutritionItems(updated);
    saveNutrition(updated);
  }

  function handleItemsDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const updated = arrayMove(
      nutritionItems,
      nutritionItems.findIndex((i) => i.id === active.id),
      nutritionItems.findIndex((i) => i.id === over.id),
    );
    setNutritionItems(updated);
    saveNutrition(updated);
  }

  // ── Global reminders ──────────────────────────────────────────────────────

  async function saveReminders(items: Reminder[]) {
    setSavingReminders(true);
    await setDoc(doc(db, "config", "reminders"), { items });
    setSavingReminders(false);
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
    const updated = arrayMove(
      reminders,
      reminders.findIndex((r) => r.id === active.id),
      reminders.findIndex((r) => r.id === over.id),
    );
    setReminders(updated);
    saveReminders(updated);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:pt-12">

        <div className="mb-8">
          <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Retour au dashboard
          </Link>
        </div>

        <header className="mb-10">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Admin</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">Nutrition & Rappels</h1>
          <p className="mt-2 text-muted-foreground">Checklist nutrition personnalisée par élève — rappels généraux communs à tous.</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[300px,1fr]">

          {/* ── Student list ──────────────────────────────────────────────── */}
          <aside className="rounded-3xl border border-border/60 bg-card shadow-soft">
            <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-display text-base font-semibold">Élèves</span>
              {!loadingUsers && (
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{users.length}</span>
              )}
            </div>
            {loadingUsers ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ul className="divide-y divide-border/40 p-2">
                {users.map((u) => (
                  <li key={u.uid}>
                    <button
                      onClick={() => selectUser(u)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-muted/60 ${selectedUser?.uid === u.uid ? "bg-primary-soft" : ""}`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                        {(u.displayName ?? u.email)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{u.displayName ?? u.email}</p>
                        {u.displayName && <p className="truncate text-xs text-muted-foreground">{u.email}</p>}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {/* ── Right panel ───────────────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Per-student checklist */}
            <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
              <div className="flex items-center justify-between border-b border-border/60 px-6 py-5">
                <div>
                  <h2 className="font-display text-xl font-semibold">Checklist nutrition</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {selectedUser
                      ? `Items personnalisés pour ${selectedUser.displayName ?? selectedUser.email}`
                      : "Sélectionnez un élève pour configurer sa checklist."}
                  </p>
                </div>
                {savingNutrition && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              {!selectedUser ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Users className="mb-3 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Sélectionnez un élève dans la liste</p>
                </div>
              ) : loadingNutrition ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {nutritionItems.length > 0 && (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemsDragEnd}>
                      <SortableContext items={nutritionItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                        <ul className="divide-y divide-border/40">
                          {nutritionItems.map((item) => (
                            <SortableNutritionItem key={item.id} item={item} onRemove={() => removeItem(item.id)} />
                          ))}
                        </ul>
                      </SortableContext>
                    </DndContext>
                  )}
                  <div className="p-5">
                    <div className="flex gap-2">
                      <input
                        value={newEmoji}
                        onChange={(e) => setNewEmoji(e.target.value)}
                        placeholder="🥗"
                        className="h-11 w-14 rounded-2xl border border-border bg-background px-3 text-center text-lg outline-none focus:border-primary"
                      />
                      <input
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addItem()}
                        placeholder="ex. Boire 1.5L d'eau"
                        className="h-11 flex-1 rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                      <button
                        onClick={addItem}
                        disabled={!newLabel.trim()}
                        className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* Global reminders */}
            <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
              <div className="flex items-center justify-between border-b border-border/60 px-6 py-5">
                <div>
                  <h2 className="font-display text-xl font-semibold">Rappels généraux</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">Conseils affichés à tous les élèves (non cochables).</p>
                </div>
                {savingReminders && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              {loadingReminders ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
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
                </>
              )}
            </section>

          </div>
        </div>
      </div>
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

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { StudentPicker } from "@/components/StudentPicker";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Plus, Trash2, Loader2, GripVertical, Users, Save, Check, X,
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

  // Per-student nutrition — two lists
  const [toEat, setToEat] = useState<NutritionItem[]>([]);
  const [toAvoid, setToAvoid] = useState<NutritionItem[]>([]);
  const [loadingNutrition, setLoadingNutrition] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [newEatEmoji, setNewEatEmoji] = useState("✅");
  const [newEatLabel, setNewEatLabel] = useState("");
  const [newAvoidEmoji, setNewAvoidEmoji] = useState("❌");
  const [newAvoidLabel, setNewAvoidLabel] = useState("");

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
    setToEat([]);
    setToAvoid([]);
    setIsDirty(false);
    setSaveSuccess(false);
    setNewEatLabel("");
    setNewAvoidLabel("");
    setLoadingNutrition(true);
    const snap = await getDoc(doc(db, "nutrition", u.uid));
    if (snap.exists()) {
      setToEat(snap.data().toEat ?? []);
      setToAvoid(snap.data().toAvoid ?? []);
    }
    setLoadingNutrition(false);
  }

  // ── Per-student nutrition — explicit save ──────────────────────────────────

  async function handleSave() {
    if (!selectedUser) return;
    setSaving(true);
    await setDoc(doc(db, "nutrition", selectedUser.uid), { toEat, toAvoid });
    setSaving(false);
    setIsDirty(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  }

  function addToEat() {
    if (!newEatLabel.trim()) return;
    setToEat((prev) => [...prev, { id: `e-${Date.now()}`, label: newEatLabel.trim(), emoji: newEatEmoji }]);
    setNewEatLabel("");
    setIsDirty(true);
  }

  function removeToEat(id: string) {
    setToEat((prev) => prev.filter((i) => i.id !== id));
    setIsDirty(true);
  }

  function handleEatDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setToEat((prev) => arrayMove(prev, prev.findIndex((i) => i.id === active.id), prev.findIndex((i) => i.id === over.id)));
    setIsDirty(true);
  }

  function addToAvoid() {
    if (!newAvoidLabel.trim()) return;
    setToAvoid((prev) => [...prev, { id: `a-${Date.now()}`, label: newAvoidLabel.trim(), emoji: newAvoidEmoji }]);
    setNewAvoidLabel("");
    setIsDirty(true);
  }

  function removeToAvoid(id: string) {
    setToAvoid((prev) => prev.filter((i) => i.id !== id));
    setIsDirty(true);
  }

  function handleAvoidDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setToAvoid((prev) => arrayMove(prev, prev.findIndex((i) => i.id === active.id), prev.findIndex((i) => i.id === over.id)));
    setIsDirty(true);
  }

  // ── Global reminders — auto-save ───────────────────────────────────────────

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
    const updated = arrayMove(reminders, reminders.findIndex((r) => r.id === active.id), reminders.findIndex((r) => r.id === over.id));
    setReminders(updated);
    saveReminders(updated);
  }

  return (
    <AdminShell>
      <div className="mx-auto max-w-7xl overflow-x-hidden px-4 pb-24 pt-8 sm:px-6 md:pt-12">

        <header className="mb-10">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Admin</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">Nutrition & Rappels</h1>
          <p className="mt-2 text-muted-foreground">Consignes nutritionnelles par élève — rappels généraux communs à tous.</p>
        </header>

        {/* Student picker */}
        <div className="mb-6">
          <StudentPicker
            users={users}
            selected={selectedUser}
            onSelect={selectUser}
            loading={loadingUsers}
          />
        </div>

        {/* ── Right panel ───────────────────────────────────────────────── */}
        <div className="space-y-6">

            {/* Per-student nutrition editor */}
            <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">

              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-4 sm:px-6 sm:py-5">
                <div className="min-w-0">
                  <h2 className="font-display text-xl font-semibold">Consignes nutritionnelles</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {selectedUser
                      ? `Configuration pour ${selectedUser.displayName ?? selectedUser.email}`
                      : "Sélectionnez un élève pour configurer sa nutrition."}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isDirty && (
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-600">
                      Brouillon
                    </span>
                  )}
                  {saveSuccess && !isDirty && (
                    <span className="flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
                      <Check className="h-3 w-3" /> Sauvegardé
                    </span>
                  )}
                  {selectedUser && (
                    <button
                      onClick={handleSave}
                      disabled={saving || !isDirty}
                      className="flex items-center gap-2 rounded-2xl bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Sauvegarder
                    </button>
                  )}
                </div>
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
                <div className="divide-y divide-border/60">

                  {/* À privilégier */}
                  <div>
                    <div className="flex items-center gap-2 px-6 py-4">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="font-display text-base font-semibold text-primary">À privilégier</span>
                      <span className="ml-auto rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">{toEat.length}</span>
                    </div>

                    {toEat.length > 0 && (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEatDragEnd}>
                        <SortableContext items={toEat.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                          <ul className="divide-y divide-border/40 border-t border-border/40">
                            {toEat.map((item) => (
                              <SortableItem key={item.id} item={item} onRemove={() => removeToEat(item.id)} />
                            ))}
                          </ul>
                        </SortableContext>
                      </DndContext>
                    )}

                    <div className="p-5">
                      <AddItemRow
                        emoji={newEatEmoji}
                        label={newEatLabel}
                        placeholder="ex. Légumes verts, protéines maigres…"
                        onEmojiChange={setNewEatEmoji}
                        onLabelChange={setNewEatLabel}
                        onAdd={addToEat}
                      />
                    </div>
                  </div>

                  {/* À éviter */}
                  <div>
                    <div className="flex items-center gap-2 px-6 py-4">
                      <X className="h-4 w-4 text-destructive" />
                      <span className="font-display text-base font-semibold text-destructive">À éviter</span>
                      <span className="ml-auto rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{toAvoid.length}</span>
                    </div>

                    {toAvoid.length > 0 && (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleAvoidDragEnd}>
                        <SortableContext items={toAvoid.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                          <ul className="divide-y divide-border/40 border-t border-border/40">
                            {toAvoid.map((item) => (
                              <SortableItem key={item.id} item={item} onRemove={() => removeToAvoid(item.id)} />
                            ))}
                          </ul>
                        </SortableContext>
                      </DndContext>
                    )}

                    <div className="p-5">
                      <AddItemRow
                        emoji={newAvoidEmoji}
                        label={newAvoidLabel}
                        placeholder="ex. Produits laitiers, sucres raffinés…"
                        onEmojiChange={setNewAvoidEmoji}
                        onLabelChange={setNewAvoidLabel}
                        onAdd={addToAvoid}
                      />
                    </div>
                  </div>

                </div>
              )}
            </section>

            {/* Global reminders */}
            <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-4 sm:px-6 sm:py-5">
                <div className="min-w-0">
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
                        placeholder="ex. Fais attention à ton alimentation…"
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
    </AdminShell>
  );
}

// ─── Shared add-item row ───────────────────────────────────────────────────────

function AddItemRow({
  emoji, label, placeholder, onEmojiChange, onLabelChange, onAdd,
}: {
  emoji: string;
  label: string;
  placeholder: string;
  onEmojiChange: (v: string) => void;
  onLabelChange: (v: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex gap-2">
      <input
        value={emoji}
        onChange={(e) => onEmojiChange(e.target.value)}
        className="h-11 w-14 rounded-2xl border border-border bg-background px-3 text-center text-lg outline-none focus:border-primary"
      />
      <input
        value={label}
        onChange={(e) => onLabelChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onAdd()}
        placeholder={placeholder}
        className="h-11 flex-1 rounded-2xl border border-border bg-background px-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <button
        onClick={onAdd}
        disabled={!label.trim()}
        className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Sortable items ───────────────────────────────────────────────────────────

function SortableItem({ item, onRemove }: { item: NutritionItem; onRemove: () => void }) {
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

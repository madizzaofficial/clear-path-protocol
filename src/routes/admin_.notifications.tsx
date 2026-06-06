import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";

export const Route = createFileRoute("/admin_/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Admin" }] }),
  component: NotificationsPage,
});

type AdminNotification = {
  id: string;
  type: "new_student";
  studentName: string;
  studentEmail: string;
  studentUid: string;
  read: boolean;
  hidden?: boolean;
  createdAt: number;
};

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Aujourd'hui à ${time}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Hier à ${time}`;
  return `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} à ${time}`;
}

function NotificationsPage() {
  const { isAdmin } = useAuth();
  const [notifs, setNotifs] = useState<AdminNotification[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, "admin_notifications"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setNotifs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminNotification)));
    });
  }, [isAdmin]);

  async function markRead(id: string) {
    await updateDoc(doc(db, "admin_notifications", id), { read: true });
  }

  async function markAllRead() {
    await Promise.all(notifs.filter((n) => !n.read).map((n) => markRead(n.id)));
  }

  const unread = notifs.filter((n) => !n.read && !n.hidden).length;

  return (
    <AdminShell>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">Notifications</h1>
              {unread > 0 && (
                <p className="text-sm text-muted-foreground">{unread} non lue{unread > 1 ? "s" : ""}</p>
              )}
            </div>
          </div>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              <CheckCheck className="h-4 w-4" /> Tout marquer lu
            </button>
          )}
        </div>

        {notifs.length === 0 ? (
          <div className="rounded-2xl border border-border/60 p-12 text-center text-muted-foreground">
            Aucune notification pour l'instant.
          </div>
        ) : (
          <div className="space-y-2">
            {notifs.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-4 rounded-2xl border p-4 transition-colors ${
                  n.hidden ? "border-border/40 bg-muted/20 opacity-50" :
                  !n.read ? "border-primary/20 bg-primary-soft/20" : "border-border/60 bg-card"
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg">
                  🎓
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium leading-tight">
                      Nouvel élève inscrit — {n.studentName || n.studentEmail}
                    </p>
                    {n.hidden && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Effacée</span>
                    )}
                    {!n.hidden && !n.read && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Non lue</span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{n.studentEmail}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                    <Link
                      to="/admin/student/$uid"
                      params={{ uid: n.studentUid }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Voir le profil →
                    </Link>
                    {!n.hidden && !n.read && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Marquer lu
                      </button>
                    )}
                  </div>
                </div>
                {!n.hidden && !n.read && (
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}

import { useEffect, useState, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  where,
  limit,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";

type AdminNotification = {
  id: string;
  type: "new_student" | "payment";
  studentName: string;
  studentEmail: string;
  studentUid: string;
  message?: string;
  read: boolean;
  createdAt: number;
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

export function AdminBell() {
  const [notifs, setNotifs] = useState<AdminNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, "admin_notifications"),
      where("hidden", "!=", true),
      orderBy("hidden"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    return onSnapshot(q, (snap) => {
      setNotifs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminNotification)));
    });
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unread = notifs.filter((n) => !n.read).length;
  const preview = notifs.slice(0, 5);

  async function markRead(id: string) {
    await updateDoc(doc(db, "admin_notifications", id), { read: true });
  }

  async function markAllRead() {
    await Promise.all(notifs.filter((n) => !n.read).map((n) => markRead(n.id)));
  }

  async function clearAll() {
    await Promise.all(notifs.map((n) => updateDoc(doc(db, "admin_notifications", n.id), { hidden: true, read: true })));
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft outline-none ring-offset-2 transition-all hover:ring-2 hover:ring-primary/30"
      >
        <Bell className="h-4 w-4 text-foreground" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-border/60 bg-background shadow-elegant">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <div className="flex items-center gap-3">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                  Tout marquer lu
                </button>
              )}
              {notifs.length > 0 && (
                <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-destructive hover:underline">
                  Effacer tout
                </button>
              )}
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {preview.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Aucune notification</p>
            ) : (
              preview.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${!n.read ? "bg-primary-soft/30" : ""}`}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm">
                    {n.type === "payment" ? "💰" : "🎓"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">
                      {n.type === "payment"
                        ? (n.message || "Paiement reçu") + ` — ${n.studentName || n.studentEmail}`
                        : `Nouvel élève — ${n.studentName || n.studentEmail}`}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.studentEmail}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      {!n.read && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="text-xs text-primary hover:underline"
                        >
                          Marquer lu
                        </button>
                      )}
                      {n.type !== "payment" && n.studentUid && (
                        <Link
                          to="/admin/student/$uid"
                          params={{ uid: n.studentUid }}
                          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                          onClick={() => setOpen(false)}
                        >
                          Voir →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border/60 px-4 py-2.5">
            <Link
              to="/admin/notifications"
              className="block text-center text-xs font-medium text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              Voir toutes les notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

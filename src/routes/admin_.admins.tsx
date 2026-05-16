import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs,
  arrayUnion, arrayRemove,
} from "firebase/firestore";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff, UserPlus, Mail } from "lucide-react";

export const Route = createFileRoute("/admin_/admins")({
  head: () => ({ meta: [{ title: "Gestion des admins — Protocole Clear" }] }),
  component: AdminsPage,
});

type AdminProfile = {
  uid: string;
  email: string;
  displayName: string | null;
};

function AdminsPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
    if (!authLoading && user && !isAdmin) navigate({ to: "/" });
  }, [user, authLoading, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    loadAdmins();
  }, [isAdmin]);

  async function loadAdmins() {
    setLoading(true);
    try {
      const configSnap = await getDoc(doc(db, "config", "admins"));
      const uids: string[] = configSnap.exists() ? (configSnap.data()?.uids ?? []) : [];
      if (uids.length === 0) { setAdmins([]); setLoading(false); return; }

      const profiles = await Promise.all(
        uids.map(async (uid) => {
          const snap = await getDoc(doc(db, "users", uid));
          if (!snap.exists()) return { uid, email: uid, displayName: null };
          return { uid, email: snap.data().email ?? uid, displayName: snap.data().displayName ?? null };
        })
      );
      setAdmins(profiles);
    } catch {
      toast.error("Impossible de charger les admins.");
    } finally {
      setLoading(false);
    }
  }

  async function grantAdmin() {
    const email = emailInput.trim().toLowerCase();
    if (!email || adding) return;
    setAdding(true);
    try {
      const q = query(collection(db, "users"), where("email", "==", email));
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.error("Aucun utilisateur trouvé avec cet e-mail.");
        return;
      }
      const targetDoc = snap.docs[0];
      const uid = targetDoc.id;

      if (admins.some((a) => a.uid === uid)) {
        toast.error("Cet utilisateur est déjà admin.");
        return;
      }

      await setDoc(doc(db, "config", "admins"), { uids: arrayUnion(uid) }, { merge: true });
      await updateDoc(doc(db, "users", uid), { is_admin: true });

      setAdmins((prev) => [
        ...prev,
        {
          uid,
          email: targetDoc.data().email ?? email,
          displayName: targetDoc.data().displayName ?? null,
        },
      ]);
      setEmailInput("");
      toast.success("Accès admin accordé.");
    } catch {
      toast.error("Impossible d'accorder l'accès admin.");
    } finally {
      setAdding(false);
    }
  }

  async function revokeAdmin(uid: string) {
    if (uid === user?.uid) {
      toast.error("Tu ne peux pas révoquer ton propre accès.");
      return;
    }
    setRevoking(uid);
    try {
      await updateDoc(doc(db, "config", "admins"), { uids: arrayRemove(uid) });
      await updateDoc(doc(db, "users", uid), { is_admin: false });
      setAdmins((prev) => prev.filter((a) => a.uid !== uid));
      toast.success("Accès admin révoqué.");
    } catch {
      toast.error("Impossible de révoquer l'accès.");
    } finally {
      setRevoking(null);
    }
  }

  if (authLoading || !isAdmin) return null;

  return (
    <AdminShell>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8 md:pt-10">
        <header className="mb-8">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Paramètres</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">Gestion des admins</h1>
          <p className="mt-2 text-muted-foreground">
            Seuls les admins peuvent accorder ou révoquer l'accès admin.
          </p>
        </header>

        {/* Add admin */}
        <div className="mb-8 rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ajouter un admin
          </p>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") grantAdmin(); }}
                placeholder="adresse@email.com"
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-4 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <button
              onClick={grantAdmin}
              disabled={adding || !emailInput.trim()}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Accorder
            </button>
          </div>
        </div>

        {/* Admins list */}
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
          <div className="border-b border-border/60 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Admins actuels {!loading && `· ${admins.length}`}
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : admins.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aucun admin trouvé dans la configuration.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {admins.map((a) => {
                const isCurrentUser = a.uid === user?.uid;
                const initials = (a.displayName ?? a.email)
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <li key={a.uid} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{a.displayName ?? "—"}</p>
                        {isCurrentUser && (
                          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
                            Vous
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{a.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <button
                        onClick={() => revokeAdmin(a.uid)}
                        disabled={revoking === a.uid || isCurrentUser}
                        title={isCurrentUser ? "Impossible de révoquer ton propre accès" : "Révoquer l'accès admin"}
                        className="flex items-center gap-1.5 rounded-xl border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {revoking === a.uid ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ShieldOff className="h-3 w-3" />
                        )}
                        Révoquer
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </AdminShell>
  );
}

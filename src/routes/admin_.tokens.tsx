import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/AdminShell";
import { useAuth } from "@/hooks/use-auth";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Link2, Copy, Check, Loader2, Clock, User, Ban, X, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ── Server function — create a student account ────────────────────────────────

const createStudentFn = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string; displayName: string; callerToken: string }) => d)
  .handler(async (ctx) => {
    const encoded = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!encoded) throw new Error("FIREBASE_SERVICE_ACCOUNT manquant");

    const { getApps: _getApps, initializeApp: _initApp, cert: _cert } = await import("firebase-admin/app");
    const { getAuth: _getAuth } = await import("firebase-admin/auth");
    const { getFirestore: _getFs } = await import("firebase-admin/firestore");

    const adminApp = _getApps().find((a) => a.name === "admin")
      ?? _initApp({ credential: _cert(JSON.parse(Buffer.from(encoded, "base64").toString("utf8"))) }, "admin");

    const adminAuth = _getAuth(adminApp);
    const adminDb = _getFs(adminApp);

    // 1. Verify caller
    let callerUid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(ctx.data.callerToken);
      callerUid = decoded.uid;
    } catch {
      throw new Error("Unauthorized: invalid token");
    }

    // 2. Check caller is admin
    const configSnap = await adminDb.collection("config").doc("admins").get();
    const adminUids: string[] = configSnap.data()?.uids ?? [];
    if (!adminUids.includes(callerUid)) throw new Error("Forbidden: not an admin");

    const { email, password, displayName } = ctx.data;
    const userRecord = await adminAuth.createUser({ email, password, displayName });
    const uid = userRecord.uid;

    await adminDb.collection("users").doc(uid).create({
      uid,
      email,
      displayName,
      photoURL: null,
      enrolledAt: Date.now(),
      welcomeSeen: false,
    });

    await adminDb.collection("admin_notifications").add({
      type: "new_student",
      studentUid: uid,
      studentName: displayName,
      studentEmail: email,
      read: false,
      createdAt: Date.now(),
    });

    return { uid };
  });

export const Route = createFileRoute("/admin_/tokens")({
  head: () => ({
    meta: [
      { title: "Liens d'invitation — Protocole Clear" },
      { name: "description", content: "Gestion des liens d'onboarding." },
    ],
  }),
  component: TokensPage,
});

type TokenDoc = {
  id: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
  usedBy?: string;
  usedAt?: number;
  recipientName?: string;
};

type StudentDoc = {
  uid: string;
  email: string;
  displayName: string | null;
};

function tokenStatus(t: TokenDoc): "active" | "used" | "expired" {
  if (t.used) return "used";
  if (t.expiresAt < Date.now()) return "expired";
  return "active";
}

function TokensPage() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [tokens, setTokens] = useState<TokenDoc[]>([]);
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<Set<string>>(new Set());
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  // Manual student creation
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
    if (!loading && user && !isAdmin) navigate({ to: "/" });
  }, [user, loading, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([
      getDocs(collection(db, "onboarding_tokens")),
      getDocs(collection(db, "users")),
    ]).then(([tokensSnap, usersSnap]) => {
      const sorted = tokensSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as TokenDoc))
        .sort((a, b) => b.createdAt - a.createdAt);
      setTokens(sorted);
      setStudents(usersSnap.docs.map((d) => d.data() as StudentDoc));
      setLoadingData(false);
    });
  }, [isAdmin]);

  if (loading || !user || !isAdmin) return null;

  async function generateLink() {
    setGeneratingLink(true);
    const token = crypto.randomUUID();
    const now = Date.now();
    const trimmedName = recipientName.trim();
    await setDoc(doc(db, "onboarding_tokens", token), {
      createdAt: now,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000,
      used: false,
      ...(trimmedName && { recipientName: trimmedName }),
    });
    const link = `${window.location.origin}/start/${token}`;
    setGeneratedLink(link);
    setTokens((prev) => [{ id: token, createdAt: now, expiresAt: now + 7 * 86400000, used: false, ...(trimmedName && { recipientName: trimmedName }) }, ...prev]);
    setRecipientName("");
    await navigator.clipboard.writeText(link).catch(() => {});
    setGeneratingLink(false);
  }

  async function revokeToken(id: string) {
    setRevoking((prev) => new Set(prev).add(id));
    await updateDoc(doc(db, "onboarding_tokens", id), { expiresAt: Date.now() - 1 });
    setTokens((prev) => prev.map((t) => t.id === id ? { ...t, expiresAt: Date.now() - 1 } : t));
    setRevoking((prev) => { const s = new Set(prev); s.delete(id); return s; });
    setConfirmRevoke(null);
  }

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    setAddLoading(true);
    try {
      const callerToken = await auth.currentUser?.getIdToken();
      if (!callerToken) throw new Error("Non authentifié");
      const { uid } = await createStudentFn({
        data: { email: addEmail.trim(), password: addPassword, displayName: addName.trim(), callerToken },
      });
      setShowAddStudent(false);
      setAddName(""); setAddEmail(""); setAddPassword("");
      navigate({ to: "/admin/student/$uid", params: { uid } });
    } catch (err: any) {
      setAddError(err?.message ?? "Erreur inconnue");
    } finally {
      setAddLoading(false);
    }
  }

  async function copyLink(link: string, id: string) {
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const activeCount = tokens.filter((t) => tokenStatus(t) === "active").length;
  const usedCount = tokens.filter((t) => tokenStatus(t) === "used").length;
  const expiredCount = tokens.filter((t) => tokenStatus(t) === "expired").length;

  return (
    <AdminShell>
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 md:pt-12">

        <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Admin</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">
              Liens d'invitation
            </h1>
            <p className="mt-2 text-muted-foreground">
              Créez des liens d'onboarding à usage unique valables 7 jours.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Prénom (optionnel)"
              className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 w-40"
            />
            <button
              onClick={generateLink}
              disabled={generatingLink}
              className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background shadow-elegant transition-all hover:opacity-90 disabled:opacity-60"
            >
              {generatingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Nouveau lien
            </button>
            <button
              onClick={() => setShowAddStudent(true)}
              className="flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium shadow-soft transition-all hover:bg-muted"
            >
              <UserPlus className="h-4 w-4" />
              Ajouter manuellement
            </button>
          </div>
        </header>

        {/* Generated link banner */}
        {generatedLink && (
          <div className="mb-8 flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-soft">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft">
              <Link2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Lien copié dans le presse-papier
              </p>
              <p className="truncate font-mono text-sm text-foreground">{generatedLink}</p>
            </div>
            <button
              onClick={() => copyLink(generatedLink, "banner")}
              className="flex shrink-0 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              {copiedId === "banner" ? (
                <><Check className="h-4 w-4 text-primary" /> Copié</>
              ) : (
                <><Copy className="h-4 w-4" /> Copier</>
              )}
            </button>
          </div>
        )}

        {/* Stats */}
        {!loadingData && tokens.length > 0 && (
          <div className="mb-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border/60 bg-card p-4 text-center shadow-soft">
              <p className="font-display text-2xl font-semibold text-primary">{activeCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Actifs</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-4 text-center shadow-soft">
              <p className="font-display text-2xl font-semibold">{usedCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Utilisés</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-4 text-center shadow-soft">
              <p className="font-display text-2xl font-semibold text-muted-foreground">{expiredCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Expirés</p>
            </div>
          </div>
        )}

        {/* Token list */}
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
          {loadingData ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : tokens.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Link2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Aucun lien créé pour l'instant.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {tokens.map((t) => {
                const status = tokenStatus(t);
                const usedByStudent = students.find((s) => s.uid === t.usedBy);
                const tokenLink = `${typeof window !== "undefined" ? window.location.origin : ""}/start/${t.id}`;

                return (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      status === "active" ? "bg-primary-soft" : "bg-muted"
                    }`}>
                      {status === "active" ? (
                        <Link2 className="h-4 w-4 text-primary" />
                      ) : status === "used" ? (
                        <User className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Ban className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          status === "active"
                            ? "bg-primary-soft text-primary"
                            : status === "used"
                            ? "bg-muted text-muted-foreground"
                            : "bg-muted/50 text-muted-foreground/50"
                        }`}>
                          {status === "active" ? "Actif" : status === "used" ? "Utilisé" : "Expiré"}
                        </span>
                        {t.recipientName && (
                          <span className="text-xs font-medium text-foreground">— {t.recipientName}</span>
                        )}
                        {status === "active" && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Expire le {new Date(t.expiresAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        <p>{new Date(t.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
                        <p>{new Date(t.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                        {status === "used" && (
                          <>
                            <span>·</span>
                            <span className="font-medium text-foreground">
                              {usedByStudent ? (usedByStudent.displayName ?? usedByStudent.email) : "Élève inconnu"}
                            </span>
                            {t.usedAt && (
                              <>
                                <span>·</span>
                                <span>{new Date(t.usedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</span>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {status === "active" && (
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() => copyLink(tokenLink, t.id)}
                          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                        >
                          {copiedId === t.id ? (
                            <><Check className="h-3.5 w-3.5 text-primary" /> Copié</>
                          ) : (
                            <><Copy className="h-3.5 w-3.5" /> Copier</>
                          )}
                        </button>
                        {confirmRevoke === t.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => revokeToken(t.id)}
                              disabled={revoking.has(t.id)}
                              className="flex items-center gap-1 rounded-xl bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                            >
                              {revoking.has(t.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              Confirmer
                            </button>
                            <button
                              onClick={() => setConfirmRevoke(null)}
                              className="flex items-center rounded-xl border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRevoke(t.id)}
                            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                          >
                            <Ban className="h-3.5 w-3.5" /> Révoquer
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

      </main>

      {/* Add student manually */}
      <Dialog open={showAddStudent} onOpenChange={setShowAddStudent}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Ajouter un élève manuellement</DialogTitle>
          </DialogHeader>
          <form onSubmit={addStudent} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Nom complet</label>
              <input
                type="text"
                required
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Prénom Nom"
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                required
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="eleve@email.com"
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Mot de passe temporaire</label>
              <input
                type="password"
                required
                minLength={6}
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                placeholder="Min. 6 caractères"
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-xs text-muted-foreground">L'élève pourra le changer depuis son profil.</p>
            </div>
            {addError && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{addError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddStudent(false)}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={addLoading}
                className="flex items-center gap-2 rounded-xl bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Créer le compte
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

    </AdminShell>
  );
}

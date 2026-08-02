import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, type User as FirebaseUser } from "firebase/auth";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { createAdminNotificationFn } from "@/lib/admin-notifications";
import {
  Loader2,
  Lock,
  Mail,
  User,
  LinkIcon,
  Sparkles,
} from "lucide-react";

// ── Server function — finalize student signup ─────────────────────────────────
//
// Flow:
//  1. Client calls createUserWithEmailAndPassword (creates Firebase Auth user).
//  2. Client passes the resulting ID token + the chosen password to this handler.
//  3. Handler atomically claims the onboarding token, then transfers the
//     admin-created profile (users/{uid_admin} + intake_answers/{uid_admin} +
//     routines/{uid_admin}) onto the real Firebase Auth UID.

const completeStudentSignupFn = createServerFn({ method: "POST" })
  .inputValidator((d: {
    token: string;
    password: string;
    callerToken: string;
  }) => d)
  .handler(async (ctx) => {
    const { token, password, callerToken } = ctx.data;

    const encoded = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!encoded) throw new Error("FIREBASE_SERVICE_ACCOUNT manquant");

    const app = getApps().find((a) => a.name === "admin")
      ?? initializeApp(
           { credential: cert(JSON.parse(Buffer.from(encoded, "base64").toString("utf8"))) },
           "admin"
         );

    const adminAuth = getAdminAuth(app);
    const adminDb = getAdminFirestore(app);

    // 1. Verify caller's ID token (the freshly-created student).
    let callerUid: string;
    let callerEmail: string | undefined;
    try {
      const decoded = await adminAuth.verifyIdToken(callerToken);
      callerUid = decoded.uid;
      callerEmail = decoded.email;
    } catch {
      throw new Error("Unauthorized: invalid token");
    }

    // 2. Atomic token claim + read intendedFor / recipientName / intendedEmail.
    const tokenRef = adminDb.collection("onboarding_tokens").doc(token);
    let claimed: { intendedFor: string; recipientName?: string; intendedEmail?: string };
    try {
      claimed = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(tokenRef);
        if (!snap.exists) throw new Error("TOKEN_INVALID");
        const data = snap.data() as { used?: boolean; expiresAt?: number; intendedFor?: string; recipientName?: string; intendedEmail?: string };
        if (data.used) throw new Error("TOKEN_ALREADY_USED");
        if (!data.expiresAt || data.expiresAt < Date.now()) throw new Error("TOKEN_EXPIRED");
        if (!data.intendedFor) throw new Error("TOKEN_NOT_LINKED");
        tx.update(tokenRef, {
          used: true,
          usedAt: Date.now(),
          usedBy: callerUid,
        });
        return {
          intendedFor: data.intendedFor,
          recipientName: data.recipientName,
          intendedEmail: data.intendedEmail,
        };
      });
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : "TOKEN_INVALID");
    }

    const adminUid = claimed.intendedFor;
    const adminUserRef = adminDb.collection("users").doc(adminUid);
    const adminUserSnap = await adminUserRef.get();
    if (!adminUserSnap.exists) {
      throw new Error("PROFILE_MISSING");
    }
    const adminProfile = adminUserSnap.data() as {
      displayName?: string;
      email?: string | null;
      photoURL?: string | null;
      enrolledAt?: number;
      adminCreated?: boolean;
      accountType?: string;
    };

    // 3. Sync the password to the Auth account (Web SDK may have used a different one).
    try {
      await adminAuth.updateUser(callerUid, { password });
    } catch (err: unknown) {
      // If user not found, rethrow; otherwise keep going (password may already be set).
      const code = (err as { code?: string }).code;
      if (code && code !== "auth/user-not-found") throw err;
    }

    // 4. Create users/{callerUid} with merge — preserve admin-prepared fields.
    const authUserRef = adminDb.collection("users").doc(callerUid);
    await authUserRef.set(
      {
        uid: callerUid,
        email: callerEmail ?? adminProfile.email ?? null,
        displayName: adminProfile.displayName ?? claimed.recipientName ?? null,
        photoURL: adminProfile.photoURL ?? null,
        enrolledAt: adminProfile.enrolledAt ?? Date.now(),
        welcomeSeen: false,
        adminCreated: adminProfile.adminCreated ?? true,
        accountType: adminProfile.accountType ?? "routine_only",
        lastSeen: Date.now(),
      },
      { merge: true }
    );

    // 5. Transfer intake_answers/{adminUid} → intake_answers/{callerUid}.
    const intakeRef = adminDb.collection("intake_answers").doc(adminUid);
    const intakeSnap = await intakeRef.get();
    if (intakeSnap.exists) {
      const intakeData = intakeSnap.data() as Record<string, unknown>;
      await adminDb
        .collection("intake_answers")
        .doc(callerUid)
        .set({ ...intakeData, uid: callerUid }, { merge: true });
      await intakeRef.delete();
    }

    // 6. Transfer routines/{adminUid} → routines/{callerUid}.
    const routineRef = adminDb.collection("routines").doc(adminUid);
    const routineSnap = await routineRef.get();
    if (routineSnap.exists) {
      const routineData = routineSnap.data() as Record<string, unknown>;
      await adminDb
        .collection("routines")
        .doc(callerUid)
        .set({ ...routineData, uid: callerUid }, { merge: true });
      await routineRef.delete();
    }

    // 7. Delete the admin-created stub user.
    await adminUserRef.delete();

    // 8. Notify admin. (Ignore failure — notification is best-effort.)
    try {
      await createAdminNotificationFn({
        data: {
          type: "new_student",
          studentUid: callerUid,
          studentName: adminProfile.displayName ?? claimed.recipientName ?? "",
          studentEmail: callerEmail ?? adminProfile.email ?? "",
          callerToken,
        },
      });
    } catch {
      // adminId mismatch (non-admin caller) — caller is the student, so this WILL fail.
      // We use a separate admin call path here: the admin SDK bypasses rules, so we
      // write the notification directly without requiring caller to be admin.
      await adminDb.collection("admin_notifications").add({
        type: "new_student",
        studentUid: callerUid,
        studentName: adminProfile.displayName ?? claimed.recipientName ?? "",
        studentEmail: callerEmail ?? adminProfile.email ?? "",
        read: false,
        createdAt: Date.now(),
      });
    }

    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/start/$token")({
  head: () => ({ meta: [{ title: "Créer ton compte — Protocole Clear" }] }),
  component: OnboardingPage,
});

// ── Page ─────────────────────────────────────────────────────────────────────

type TokenStatus = "checking" | "invalid" | "valid";

function OnboardingPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [tokenStatus, setTokenStatus] = useState<TokenStatus>("checking");
  const [recipientName, setRecipientName] = useState("");
  const [intendedEmail, setIntendedEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // If already logged in, bounce to /products (or /suivi for full).
  useEffect(() => {
    if (!authLoading && user) {
      navigate({ to: "/products" });
    }
  }, [user, authLoading, navigate]);

  // Validate token + read recipientName / intendedEmail.
  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, "onboarding_tokens", token)).then((snap) => {
      if (cancelled) return;
      if (!snap.exists() || snap.data().used || snap.data().expiresAt < Date.now()) {
        setTokenStatus("invalid");
        return;
      }
      const data = snap.data();
      setRecipientName(data.recipientName ?? "");
      setIntendedEmail(data.intendedEmail ?? "");
      setTokenStatus("valid");
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Le mot de passe doit faire au moins 6 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (!intendedEmail) {
      setError("Aucun email n'est associé à ce lien. Contacte ton coach.");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Create the Auth account with the email + password.
      const credential = await createUserWithEmailAndPassword(auth, intendedEmail, password);
      const fbUser: FirebaseUser = credential.user;

      // 2. Get the ID token and call the server fn to transfer the profile.
      const callerToken = await fbUser.getIdToken();
      await completeStudentSignupFn({
        data: { token, password, callerToken },
      });

      // 3. Force a reload of the auth context so accountType is fresh.
      navigate({ to: "/products" });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      const msg = (err as { message?: string }).message;
      if (code === "auth/email-already-in-use") {
        setError("Un compte existe déjà avec cet email. Connecte-toi à la place.");
      } else if (code === "auth/weak-password") {
        setError("Mot de passe trop faible (6 caractères minimum).");
      } else if (msg === "TOKEN_ALREADY_USED") {
        setError("Ce lien a déjà été utilisé.");
      } else if (msg === "TOKEN_EXPIRED") {
        setError("Ce lien a expiré. Demande un nouveau lien à ton coach.");
      } else if (msg === "PROFILE_MISSING") {
        setError("Le profil préparé par ton coach est introuvable. Contacte-le.");
      } else {
        setError(msg || "Erreur inconnue. Réessaie ou contacte ton coach.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── States ────────────────────────────────────────────────────────────────

  if (authLoading || tokenStatus === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (tokenStatus === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <LinkIcon className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Lien invalide</h1>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Ce lien a déjà été utilisé ou a expiré. Contacte ton coach pour recevoir un nouveau lien d'accès.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Finalise ton inscription
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ton coach a déjà préparé ton espace. Choisis un mot de passe pour y accéder.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-card p-6 shadow-soft"
        >
          {/* Prénom (lecture seule) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Prénom</label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={recipientName}
                readOnly
                className="w-full rounded-xl border border-border bg-muted/40 py-2.5 pl-10 pr-3 text-sm text-foreground outline-none"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Pour modifier, demande à ton coach.
            </p>
          </div>

          {/* Email (lecture seule) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={intendedEmail}
                readOnly
                className="w-full rounded-xl border border-border bg-muted/40 py-2.5 pl-10 pr-3 text-sm text-foreground outline-none"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Cet email te servira de login.
            </p>
          </div>

          {/* Mot de passe */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Mot de passe <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 caractères minimum"
                autoComplete="new-password"
                required
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Confirmation */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Confirme le mot de passe <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="À nouveau"
                autoComplete="new-password"
                required
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background shadow-elegant transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> On configure ton espace…
              </>
            ) : (
              "Créer mon compte"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

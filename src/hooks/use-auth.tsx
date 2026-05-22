import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  type User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { type DocumentSnapshot, doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

// Generic messages — never reveal whether an email account exists
function normalizeAuthError(code: string): string {
  const map: Record<string, string> = {
    "auth/user-not-found": "Invalid email or password.",
    "auth/wrong-password": "Invalid email or password.",
    "auth/invalid-email": "Invalid email or password.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/user-disabled": "Invalid email or password.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/email-already-in-use": "Unable to create account. Please try again.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/network-request-failed": "Network error. Check your connection.",
  };
  return map[code] ?? "Something went wrong. Please try again.";
}

// Force logout after 12 hours of inactivity (checked against Firestore lastSeen)
const IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000;

// Primary: users/{uid}.is_admin (aligned with backend set_admin.py)
// Fallback: config/admins.uids[] for admins created before this change
async function fetchIsAdmin(uid: string, userSnap: DocumentSnapshot): Promise<boolean> {
  if (userSnap.data()?.is_admin === true) return true;
  try {
    const snap = await getDoc(doc(db, "config", "admins"));
    if (!snap.exists()) return false;
    return (snap.data()?.uids ?? []).includes(uid);
  } catch {
    return false;
  }
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  signIn: async () => {},
  signUp: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      // Débloquer le rendu immédiatement — les vérifications Firestore tournent en arrière-plan
      setLoading(false);
      try {
        const userRef = doc(db, "users", u.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.data()?.disabled === true) {
          await fbSignOut(auth);
          setUser(null);
          setIsAdmin(false);
          return;
        }
        const prevLastSeen: number | undefined = userSnap.data()?.lastSeen;
        const lastSignInMs = u.metadata?.lastSignInTime
          ? new Date(u.metadata.lastSignInTime).getTime()
          : Date.now();
        const isFreshSignIn = Date.now() - lastSignInMs < 60_000;
        if (!isFreshSignIn && prevLastSeen && Date.now() - prevLastSeen > IDLE_TIMEOUT_MS) {
          await fbSignOut(auth);
          setUser(null);
          setIsAdmin(false);
          return;
        }
        const admin = await fetchIsAdmin(u.uid, userSnap);
        const update: Record<string, unknown> = {
          uid: u.uid,
          email: u.email ?? "",
          displayName: u.displayName ?? null,
          photoURL: u.photoURL ?? null,
          lastSeen: Date.now(),
        };
        if (!userSnap.exists()) update.enrolledAt = Date.now();
        setDoc(userRef, update, { merge: true }).catch(() => {});
        setIsAdmin(admin);
      } catch {
        // Firestore inaccessible (réseau coupé, extension bloquante) — on laisse passer avec Auth seul
      }
    });
    return unsub;
  }, []);

  const signIn = async (email: string, password: string) => {
    let cred;
    try {
      cred = await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      throw new Error(normalizeAuthError(err.code));
    }
    const userSnap = await getDoc(doc(db, "users", cred.user.uid));
    if (userSnap.data()?.disabled === true) {
      await fbSignOut(auth);
      throw new Error("Ton compte a été désactivé. Contacte ton coach.");
    }
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) await updateProfile(cred.user, { displayName });
    } catch (err: any) {
      throw new Error(normalizeAuthError(err.code));
    }
  };

  const signInWithGoogle = async () => {
    let result;
    try {
      const provider = new GoogleAuthProvider();
      result = await signInWithPopup(auth, provider);
    } catch (err: any) {
      throw new Error(normalizeAuthError(err.code));
    }
    const userSnap = await getDoc(doc(db, "users", result.user.uid));
    if (userSnap.data()?.disabled === true) {
      await fbSignOut(auth);
      throw new Error("Ton compte a été désactivé. Contacte ton coach.");
    }
  };

  const signOut = async () => {
    await fbSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

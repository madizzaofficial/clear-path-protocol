// Server-only auth helpers for createServerFn handlers.
//
// TanStack Start server functions are public HTTP endpoints — Firestore rules do
// NOT protect them. Every privileged handler must verify the caller here before
// doing anything. Only call these inside a createServerFn handler (server runtime).

async function getAdminApp() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!encoded) throw new Error("FIREBASE_SERVICE_ACCOUNT manquant");

  const { getApps, initializeApp, cert } = await import("firebase-admin/app");
  return (
    getApps().find((a) => a.name === "admin") ??
    initializeApp(
      { credential: cert(JSON.parse(Buffer.from(encoded, "base64").toString("utf8"))) },
      "admin",
    )
  );
}

/** Verifies the Firebase ID token. Returns the caller's uid or throws. */
export async function requireAuth(callerToken: string): Promise<string> {
  const app = await getAdminApp();
  const { getAuth } = await import("firebase-admin/auth");
  try {
    const decoded = await getAuth(app).verifyIdToken(callerToken);
    return decoded.uid;
  } catch {
    throw new Error("Unauthorized: invalid token");
  }
}

/** Verifies the token AND that the caller is in config/admins.uids[]. Returns uid or throws. */
export async function requireAdmin(callerToken: string): Promise<string> {
  const app = await getAdminApp();
  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore } = await import("firebase-admin/firestore");

  let uid: string;
  try {
    uid = (await getAuth(app).verifyIdToken(callerToken)).uid;
  } catch {
    throw new Error("Unauthorized: invalid token");
  }

  const snap = await getFirestore(app).collection("config").doc("admins").get();
  const adminUids: string[] = snap.data()?.uids ?? [];
  if (!adminUids.includes(uid)) throw new Error("Forbidden: not an admin");
  return uid;
}

/**
 * Anti-SSRF URL guard. Rejects non-http(s) protocols and literal internal/loopback
 * hosts before a server-side fetch. Returns the parsed URL or throws.
 *
 * Note: this blocks literal internal targets (metadata IP, RFC1918, loopback). It does
 * NOT defend against DNS-rebinding to an internal IP; that residual risk is mitigated by
 * also requiring authentication on the calling endpoint.
 */
export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("URL invalide");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Protocole non autorisé");
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  const blocked =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^fc[0-9a-f]{2}:/i.test(host) ||
    /^fe80:/i.test(host);

  if (blocked) throw new Error("Hôte non autorisé");
  return url;
}

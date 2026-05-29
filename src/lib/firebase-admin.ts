import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialise l'Admin SDK une seule fois (guard hot-reload)
function getAdminApp() {
  const existing = getApps().find((a) => a.name === "admin");
  if (existing) return existing;

  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!encoded) throw new Error("FIREBASE_SERVICE_ACCOUNT env var manquant");

  const credentials = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  return initializeApp({ credential: cert(credentials) }, "admin");
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

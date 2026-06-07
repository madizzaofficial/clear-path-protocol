/**
 * bulk-delete-users.mjs
 * Supprime tous les comptes Firebase Auth + données Firestore
 * SAUF les UIDs protégés définis dans KEEP_UIDS.
 *
 * Usage:
 *   node scripts/bulk-delete-users.mjs          → dry-run (liste sans supprimer)
 *   node scripts/bulk-delete-users.mjs --confirm → suppression réelle
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// ── Charger les variables d'environnement depuis .env ─────────────────────────
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const encoded = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!encoded) {
  console.error("❌  FIREBASE_SERVICE_ACCOUNT manquant dans .env");
  process.exit(1);
}

// ── UIDs à ne jamais supprimer ─────────────────────────────────────────────────
const KEEP_UIDS = new Set([
  "aHA6HKbldVQsgTHAfXruUe61L6k2", // Sandrine
  "7leIRC0n9Cge0iaT9mYmawIRxFY2", // Admin — glowupbymehdi@protonmail.com
]);

// ── Collections Firestore à nettoyer par UID ───────────────────────────────────
const FIRESTORE_DOCS = [
  "users",
  "intake_answers",
  "routines",
  "progress",
  "routine_reports",
  "admin_skin_state",
];

// ── Init Firebase Admin ────────────────────────────────────────────────────────
if (!getApps().length) {
  const credentials = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  initializeApp({ credential: cert(credentials) }, "bulk-delete");
}

const auth = getAuth(getApps()[0]);
const db   = getFirestore(getApps()[0]);

const isDryRun = !process.argv.includes("--confirm");

// ── Lister tous les utilisateurs ───────────────────────────────────────────────
async function listAllUsers() {
  const users = [];
  let pageToken;
  do {
    const result = await auth.listUsers(1000, pageToken);
    users.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);
  return users;
}

// ── Supprimer les docs Firestore d'un utilisateur ──────────────────────────────
async function deleteFirestoreDocs(uid) {
  await Promise.allSettled(
    FIRESTORE_DOCS.map((col) => db.collection(col).doc(uid).delete())
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔍  Récupération des utilisateurs…\n");
  const allUsers = await listAllUsers();

  const toDelete = allUsers.filter((u) => !KEEP_UIDS.has(u.uid));
  const kept     = allUsers.filter((u) =>  KEEP_UIDS.has(u.uid));

  console.log(`✅  Comptes protégés (conservés) : ${kept.length}`);
  kept.forEach((u) => console.log(`    • ${u.uid}  ${u.email ?? "(pas d'email)"}`));

  console.log(`\n🗑   Comptes à supprimer : ${toDelete.length}`);
  toDelete.forEach((u) => console.log(`    • ${u.uid}  ${u.email ?? "(pas d'email)"}`));

  if (isDryRun) {
    console.log("\n⚠️   DRY-RUN — aucune suppression effectuée.");
    console.log("    Relance avec --confirm pour supprimer réellement.\n");
    return;
  }

  if (toDelete.length === 0) {
    console.log("\nRien à supprimer.\n");
    return;
  }

  console.log("\n🚀  Suppression en cours…\n");
  let ok = 0, fail = 0;

  for (const user of toDelete) {
    try {
      await auth.deleteUser(user.uid);
      await deleteFirestoreDocs(user.uid);
      console.log(`    ✓ ${user.uid}  ${user.email ?? ""}`);
      ok++;
    } catch (err) {
      console.error(`    ✗ ${user.uid}  ${err.message}`);
      fail++;
    }
  }

  console.log(`\n✅  Terminé — ${ok} supprimé(s), ${fail} échec(s)\n`);
}

main().catch((err) => {
  console.error("Erreur fatale :", err);
  process.exit(1);
});

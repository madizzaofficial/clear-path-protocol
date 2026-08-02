// Server-only helper for creating notifications addressed to admins.
//
// Client-side writes to admin_notifications are blocked by Firestore rules
// (allow create: false). This handler runs server-side with the Admin SDK,
// which bypasses rules, after verifying the caller is an admin.

import { createServerFn } from "@tanstack/react-start";

type AdminNotificationType = "new_student" | "payment";

type CreateAdminNotificationInput = {
  type: AdminNotificationType;
  studentUid: string;
  studentName: string;
  studentEmail: string;
  message?: string;
  callerToken: string;
};

export const createAdminNotificationFn = createServerFn({ method: "POST" })
  .inputValidator((d: CreateAdminNotificationInput) => d)
  .handler(async (ctx) => {
    const { callerToken, ...payload } = ctx.data;

    const { requireAdmin } = await import("@/lib/server-auth");
    await requireAdmin(callerToken);

    const { getApps, initializeApp, cert } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");

    const encoded = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!encoded) throw new Error("FIREBASE_SERVICE_ACCOUNT manquant");

    const app = getApps().find((a) => a.name === "admin")
      ?? initializeApp(
           { credential: cert(JSON.parse(Buffer.from(encoded, "base64").toString("utf8"))) },
           "admin"
         );

    const adminDb = getFirestore(app);
    await adminDb.collection("admin_notifications").add({
      ...payload,
      read: false,
      createdAt: Date.now(),
    });
  });

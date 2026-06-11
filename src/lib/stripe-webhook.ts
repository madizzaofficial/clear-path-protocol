import crypto from "node:crypto";
import { getAdminDb } from "./firebase-admin";

// ─── HTML escaping ────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SAFE_NAME_RE = /^[\p{L}\p{M}'\- ]{1,40}$/u;

function safeName(raw: string | null): string {
  const first = raw?.split(" ")[0] ?? "";
  return SAFE_NAME_RE.test(first) ? escapeHtml(first) : "là";
}

// ─── Stripe signature verification (with timestamp tolerance) ────────────────

const STRIPE_TOLERANCE_SECONDS = 300; // 5 minutes, Stripe's standard

function verifyStripeSignature(rawBody: string, sigHeader: string, secret: string): boolean {
  const parts = sigHeader.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signature = parts.find((p) => p.startsWith("v1="))?.slice(3);
  if (!timestamp || !signature) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > STRIPE_TOLERANCE_SECONDS) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─── Invitation email ─────────────────────────────────────────────────────────

function buildInviteEmailHtml(firstName: string, inviteUrl: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Ton accès Protocole Clear</title>
</head>
<body style="margin:0;padding:0;background:#fdf8f3;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 20px;">

  <!-- Logo -->
  <div style="text-align:center;margin-bottom:32px;">
    <img src="https://app.protocole-clear.com/logo_clear.png" alt="Protocole Clear" width="56" height="56"
      style="border-radius:50%;display:block;margin:0 auto 12px;border:0;" />
    <h1 style="font-family:Georgia,serif;color:#1a1a1a;margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em;">
      Protocole Clear
    </h1>
  </div>

  <!-- Main card -->
  <div style="background:white;border-radius:24px;padding:36px 32px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
    <h2 style="font-family:Georgia,serif;color:#1a1a1a;margin:0 0 14px;font-size:24px;line-height:1.2;">
      Bienvenue, ${firstName}&nbsp;! 🎉
    </h2>
    <p style="color:#555;margin:0 0 20px;line-height:1.7;font-size:15px;">
      Ton accès au Protocole Clear est prêt.<br />
      Clique sur le bouton ci-dessous pour créer ton compte et commencer ton bilan peau.
    </p>
    <p style="color:#888;margin:0 0 28px;line-height:1.65;font-size:14px;">
      Une fois inscrit(e), ton coach analysera tes réponses et tes photos pour construire ta routine personnalisée.
      Le suivi commence dès la validation de ton bilan.
    </p>

    <!-- CTA button -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${inviteUrl}"
        style="display:inline-block;background:#c97444;color:#fff;font-size:16px;font-weight:700;
               text-decoration:none;padding:16px 40px;border-radius:100px;
               box-shadow:0 4px 20px rgba(201,116,68,0.35);">
        S'inscrire sur la plateforme →
      </a>
    </div>

    <!-- Link fallback -->
    <p style="color:#bbb;font-size:12px;text-align:center;margin:0;line-height:1.6;">
      Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur&nbsp;:<br />
      <a href="${inviteUrl}" style="color:#c97444;word-break:break-all;">${inviteUrl}</a>
    </p>
  </div>

  <!-- Info card -->
  <div style="background:#fff8f4;border-radius:16px;padding:20px 24px;margin-bottom:12px;border:1px solid #f5e6d4;">
    <p style="color:#c97444;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">
      À savoir
    </p>
    <ul style="color:#777;font-size:13px;line-height:1.7;margin:0;padding:0 0 0 16px;">
      <li>Ce lien est <strong>personnel</strong> et à usage unique — ne le partage pas.</li>
      <li>Il est valable <strong>7 jours</strong>.</li>
      <li>Si tu rencontres un problème, réponds directement à cet email.</li>
    </ul>
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding-top:24px;">
    <p style="color:#ccc;font-size:12px;margin:0;line-height:1.6;">
      © 2025 Protocole Clear · protocole-clear.com<br />
      Tu reçois cet email car tu as souscrit au Protocole Clear.
    </p>
  </div>

</div>
</body>
</html>`;
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

export async function handleStripeWebhook(request: Request): Promise<Response> {
  try {
    return await _handleStripeWebhook(request);
  } catch (err) {
    console.error("[stripe-webhook] unhandled error:", err);
    return new Response("Internal error", { status: 500 });
  }
}

async function _handleStripeWebhook(request: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook secret missing", { status: 500 });

  const rawBody = await request.text();
  const sigHeader = request.headers.get("stripe-signature") ?? "";

  console.log("[stripe-webhook] body length:", rawBody.length);
  console.log("[stripe-webhook] sig header present:", sigHeader.length > 0);
  console.log("[stripe-webhook] sig header prefix:", sigHeader.slice(0, 60));

  if (!verifyStripeSignature(rawBody, sigHeader, secret)) {
    console.log("[stripe-webhook] signature mismatch — bodyLen:", rawBody.length, "secretLen:", secret.length);
    return new Response("Invalid signature", { status: 400 });
  }

  let event: { type: string; livemode: boolean; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response("Ignored", { status: 200 });
  }

  const session = event.data.object;
  const paymentStatus = session.payment_status as string;
  if (paymentStatus !== "paid") return new Response("Not paid", { status: 200 });

  const email = (session.customer_email ?? (session.customer_details as any)?.email) as string | null;
  const fullName = (session.customer_details as any)?.name as string | null;
  const firstName = safeName(fullName);

  if (!email) return new Response("No email", { status: 200 });

  // Idempotency — skip if this Stripe event was already processed
  const eventId = (event as any).id as string;
  const adminDb = getAdminDb();
  const eventRef = adminDb.collection("stripe_events_processed").doc(eventId);
  const eventSnap = await eventRef.get();
  if (eventSnap.exists) return new Response("Already processed", { status: 200 });

  // Mark event as processed before doing any side effects
  const now = Date.now();
  await eventRef.set({ processedAt: now, sessionId: session.id as string });

  // Generate unique onboarding token (7 days expiry)
  const token = crypto.randomUUID();
  await adminDb.collection("onboarding_tokens").doc(token).set({
    createdAt: now,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000,
    used: false,
    source: "stripe",
    stripeSessionId: session.id as string,
    stripeEventId: eventId,
    buyerEmail: email,
  });

  const inviteUrl = `https://app.protocole-clear.com/start/${token}`;

  // ── Journal de paiement (trace fiable, indépendante des emails Stripe) ──────
  const amountTotal = typeof session.amount_total === "number" ? session.amount_total : null;
  const currency = (session.currency as string | undefined) ?? "eur";
  await adminDb.collection("payments").doc(eventId).set({
    stripeEventId: eventId,
    stripeSessionId: session.id as string,
    buyerEmail: email,
    buyerName: fullName ?? null,
    amountTotal,           // en centimes
    currency,
    inviteToken: token,
    createdAt: now,
  });

  // ── Notification admin in-app (cloche) ──────────────────────────────────────
  const amountStr = amountTotal != null ? `${(amountTotal / 100).toFixed(2)} ${currency.toUpperCase()}` : "";
  await adminDb.collection("admin_notifications").add({
    type: "payment",
    studentName: fullName ?? email,
    studentEmail: email,
    studentUid: "",
    message: amountStr ? `Paiement reçu — ${amountStr}` : "Paiement reçu",
    read: false,
    createdAt: now,
  });

  // Send emails via Resend
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const from = (() => {
      const r = process.env.RESEND_FROM ?? "onboarding@resend.dev";
      return r.includes("<") ? r : `Protocole Clear <${r}>`;
    })();
    // Invitation à l'acheteur
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: email,
        subject: `${firstName}, ton accès Protocole Clear est prêt ✨`,
        html: buildInviteEmailHtml(firstName, inviteUrl),
      }),
    }).catch(console.error);

    // Alerte fiable au coach (indépendante de l'email Stripe)
    const adminEmail = process.env.ADMIN_EMAIL ?? "support@protocole-clear.com";
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: adminEmail,
        subject: `💰 Nouveau paiement — ${escapeHtml(fullName ?? email)}${amountStr ? ` (${amountStr})` : ""}`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
          <h2 style="margin:0 0 16px;">Nouveau paiement reçu 🎉</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#888;font-size:14px;width:110px;">Client</td><td style="padding:6px 0;font-size:14px;font-weight:600;">${escapeHtml(fullName ?? "—")}</td></tr>
            <tr><td style="padding:6px 0;color:#888;font-size:14px;">Email</td><td style="padding:6px 0;font-size:14px;">${escapeHtml(email)}</td></tr>
            ${amountStr ? `<tr><td style="padding:6px 0;color:#888;font-size:14px;">Montant</td><td style="padding:6px 0;font-size:14px;font-weight:600;">${escapeHtml(amountStr)}</td></tr>` : ""}
          </table>
          <p style="color:#888;font-size:13px;margin-top:18px;">Le lien d'invitation a été envoyé automatiquement à ${escapeHtml(email)}.</p>
        </div>`,
      }),
    }).catch(console.error);
  }

  return new Response("OK", { status: 200 });
}

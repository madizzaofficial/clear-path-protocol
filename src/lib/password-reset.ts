import { createServerFn } from "@tanstack/react-start";

export const sendPasswordResetFn = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) => d)
  .handler(async (ctx) => {
    const { email } = ctx.data;

    const projectId     = process.env.FIREBASE_PROJECT_ID;
    const clientEmail   = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY ?? "";

    console.log("[reset] env — projectId:", !!projectId, "clientEmail:", !!clientEmail, "privateKey:", !!privateKeyRaw);

    if (!projectId || !clientEmail || !privateKeyRaw) {
      console.error("[reset] Missing Firebase Admin env vars");
      return { ok: true };
    }

    let adminApp: typeof import("firebase-admin/app");
    let adminAuth: typeof import("firebase-admin/auth");
    try {
      adminApp = await import("firebase-admin/app");
      adminAuth = await import("firebase-admin/auth");
    } catch (err) {
      console.error("[reset] firebase-admin import failed:", err);
      return { ok: true };
    }

    if (!adminApp.getApps().length) {
      const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
      adminApp.initializeApp({
        credential: adminApp.cert({ projectId, clientEmail, privateKey }),
      });
    }

    let resetLink: string;
    try {
      resetLink = await adminAuth.getAuth().generatePasswordResetLink(email, {
        url: "https://app.protocole-clear.com/login",
      });
      console.log("[reset] link generated for", email);
    } catch (err) {
      console.error("[reset] generatePasswordResetLink failed:", err);
      return { ok: true };
    }

    const apiKey  = process.env.RESEND_API_KEY;
    const rawFrom = process.env.RESEND_FROM ?? "onboarding@resend.dev";
    const from    = rawFrom.includes("<") ? rawFrom : `Protocole Clear <${rawFrom}>`;

    if (!apiKey) {
      console.error("[reset] RESEND_API_KEY missing");
      return { ok: true };
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: email,
        subject: "Réinitialise ton mot de passe — Protocole Clear",
        html: buildResetEmailHtml(resetLink),
      }),
    });
    console.log("[reset] Resend status:", res.status, "for", email);

    return { ok: true };
  });

function buildResetEmailHtml(resetLink: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(135deg,#f5e6da 0%,#faf0e8 100%);padding:40px 40px 32px;text-align:center;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:#c4724b;">Protocole Clear</p>
      <h1 style="margin:0;font-size:26px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">Réinitialisation du mot de passe</h1>
    </div>
    <div style="padding:36px 40px;">
      <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#444;">Tu as demandé à réinitialiser le mot de passe de ton compte Protocole Clear.</p>
      <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#444;">Clique sur le bouton ci-dessous pour choisir un nouveau mot de passe. Le lien est valable 1 heure.</p>
      <div style="text-align:center;margin:0 0 32px;">
        <a href="${resetLink}" style="display:inline-block;background:#c4724b;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:9999px;font-size:15px;font-weight:600;letter-spacing:0.02em;">
          Réinitialiser mon mot de passe →
        </a>
      </div>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#888;">Si tu n'es pas à l'origine de cette demande, ignore cet email — ton mot de passe ne changera pas.</p>
    </div>
    <div style="border-top:1px solid #f0ece8;padding:20px 40px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">Protocole Clear · <a href="https://app.protocole-clear.com" style="color:#c4724b;text-decoration:none;">app.protocole-clear.com</a></p>
    </div>
  </div>
</body>
</html>`;
}

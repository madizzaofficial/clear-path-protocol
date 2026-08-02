// Server-only: sends the invitation email ("Ta routine est prête, {prénom} !")
// via Resend. Called from /admin/tokens when the admin clicks "Envoyer par mail".
//
// HTML template follows the same DA as the existing emails (intakeConfirmation,
// newStudentAdminAlert):
//   - background #FFF9F1 (cream), cards #ffffff, accent #c4724b
//   - logo + serif header, sans-serif body, pill CTA button
//   - 3 cards: greeting+sell, instructions, CTA+contact

import { createServerFn } from "@tanstack/react-start";

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildInvitationEmailHtml(firstName: string, signupUrl: string): string {
  const safeName = esc(firstName);
  const safeUrl = esc(signupUrl);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>Ta routine est prête — Protocole Clear</title>
<style>:root{color-scheme:light only;}</style>
</head>
<body style="margin:0;padding:0;background:#FFF9F1 !important;font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a !important;">
<div style="max-width:560px;margin:0 auto;padding:40px 20px;background:#FFF9F1 !important;">

  <!-- Logo -->
  <div style="text-align:center;margin-bottom:32px;">
    <img src="https://app.protocole-clear.com/logo_clear.png" alt="Protocole Clear" width="56" height="56" style="border-radius:50%;display:block;margin:0 auto 12px;border:0;" />
    <h1 style="font-family:Georgia,serif;color:#1a1a1a;margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em;">Protocole Clear</h1>
  </div>

  <!-- Carte 1 — Salutation + routine prête -->
  <div style="background:#ffffff !important;border-radius:24px;padding:28px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
    <h2 style="font-family:Georgia,serif;color:#1a1a1a;margin:0 0 10px;font-size:22px;">Hello ${safeName} !</h2>
    <p style="color:#555;margin:0;line-height:1.65;font-size:15px;">
      Ta routine personnalisée est prête ! Tu pourras y retrouver ta routine à suivre semaine après semaine, l'explication des choix des produits, ainsi que les instructions à suivre en plus de conseils applicables (alimentation, etc.).
    </p>
  </div>

  <!-- Carte 2 — Comment accéder -->
  <div style="background:#ffffff !important;border-radius:24px;padding:24px 28px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
    <table cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding-right:14px;">
          <div style="background:#fff3ec;border-radius:14px;padding:8px 14px;font-size:20px;line-height:1;">🔗</div>
        </td>
        <td>
          <h3 style="font-family:Georgia,serif;color:#1a1a1a;margin:0 0 4px;font-size:16px;">Pour y accéder, c'est simple</h3>
          <p style="color:#888;font-size:13px;margin:0;line-height:1.6;">
            Clique sur le bouton ci-dessous, configure ton mot de passe (ton identifiant sera l'email utilisé lors du paiement), et tu auras accès à ta routine.
          </p>
        </td>
      </tr>
    </table>
  </div>

  <!-- Carte 3 — Journal -->
  <div style="background:#ffffff !important;border-radius:24px;padding:24px 28px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
    <table cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding-right:14px;">
          <div style="background:#fff3ec;border-radius:14px;padding:8px 14px;font-size:20px;line-height:1;">📸</div>
        </td>
        <td>
          <h3 style="font-family:Georgia,serif;color:#1a1a1a;margin:0 0 4px;font-size:16px;">Le Journal pour suivre ta progression</h3>
          <p style="color:#888;font-size:13px;margin:0;line-height:1.6;">
            Tu auras également accès à une page <em>Journal</em> pour uploader tes photos, afin de pouvoir faire un suivi avant/après plus clair.
          </p>
        </td>
      </tr>
    </table>
  </div>

  <!-- CTA -->
  <div style="background:#ffffff !important;border-radius:24px;padding:24px 28px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06);text-align:center;">
    <a href="${safeUrl}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:9999px;font-size:15px;font-weight:600;letter-spacing:0.02em;">
      Accéder à ma routine →
    </a>
  </div>

  <!-- Contact -->
  <div style="background:#ffffff !important;border-radius:24px;padding:20px 28px;margin-bottom:28px;box-shadow:0 1px 4px rgba(0,0,0,0.06);text-align:center;">
    <p style="color:#555;font-size:14px;margin:0 0 6px;line-height:1.5;">La moindre question ? N'hésite pas à me répondre directement à cet email.</p>
    <p style="color:#c4724b;font-size:13px;font-weight:600;margin:0;">glowupbymehdi@pm.me</p>
  </div>

  <!-- Footer -->
  <p style="text-align:center;color:#ccc;font-size:12px;line-height:1.6;margin:0;">
    Cet email a été envoyé via <strong style="color:#c4724b;">Protocole Clear</strong>.<br>
    Hâte de voir les résultats de la routine sur ta peau ✨
  </p>

</div>
</body>
</html>`;
}

export const sendInvitationEmailFn = createServerFn({ method: "POST" })
  .inputValidator((d: {
    to: string;
    firstName: string;
    signupUrl: string;
    callerToken: string;
  }) => d)
  .handler(async (ctx) => {
    const { callerToken, to, firstName, signupUrl } = ctx.data;

    // Auth: only admins can send invitations.
    const { requireAdmin } = await import("@/lib/server-auth");
    await requireAdmin(callerToken);

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY manquant");

    const rawFrom = process.env.RESEND_FROM ?? "onboarding@resend.dev";
    const from = rawFrom.includes("<") ? rawFrom : `Protocole Clear <${rawFrom}>`;

    const subject = `Ta routine est prête, ${firstName} !`;
    const html = buildInvitationEmailHtml(firstName, signupUrl);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend a échoué (${res.status}): ${body}`);
    }

    return { ok: true };
  });

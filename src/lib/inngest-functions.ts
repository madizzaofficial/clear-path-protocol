import { inngest } from "./inngest";

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const rawFrom = process.env.RESEND_FROM ?? "onboarding@resend.dev";
  const from = rawFrom.includes("<") ? rawFrom : `Protocole Clear <${rawFrom}>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
}

type UserPayload = { uid: string; email: string; firstName: string };


// ── intake-confirmation ──────────────────────────────────────────────────────
// Sends a confirmation email immediately when a user submits their intake form.

export const intakeConfirmation = inngest.createFunction(
  { id: "intake-confirmation", triggers: [{ event: "user/intake.completed" }] },
  async ({ event, step }: { event: { data: UserPayload }; step: any }) => {
    const { uid, email, firstName } = event.data;

    await step.run("send-confirmation", () =>
      sendEmail(
        email,
        `Nous avons bien reçu tes informations, ${firstName} ✅`,
        `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Bilan reçu — Protocole Clear</title>
</head>
<body style="margin:0;padding:0;background:#FFF9F1;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 20px;background:#FFF9F1;">

  <!-- Logo -->
  <div style="text-align:center;margin-bottom:32px;">
    <img src="https://app.protocole-clear.com/logo_clear.png" alt="Protocole Clear" width="56" height="56" style="border-radius:50%;display:block;margin:0 auto 12px;border:0;" />
    <h1 style="font-family:Georgia,serif;color:#1a1a1a;margin:0;font-size:20px;font-weight:600;letter-spacing:-0.02em;">Protocole Clear</h1>
  </div>

  <!-- Message principal -->
  <div style="background:white;border-radius:24px;padding:28px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
    <h2 style="font-family:Georgia,serif;color:#1a1a1a;margin:0 0 10px;font-size:22px;">Bonjour ${firstName} !</h2>
    <p style="color:#555;margin:0;line-height:1.65;font-size:15px;">
      Nous avons bien reçu ton questionnaire et tes éventuelles photos. Je vais maintenant analyser ton profil afin de construire une routine adaptée à ta peau.
    </p>
  </div>

  <!-- Délai -->
  <div style="background:white;border-radius:24px;padding:24px 28px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
    <table cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding-right:14px;">
          <div style="background:#fff3ec;border-radius:14px;padding:8px 14px;font-size:20px;line-height:1;">⏱</div>
        </td>
        <td>
          <h3 style="font-family:Georgia,serif;color:#1a1a1a;margin:0 0 4px;font-size:16px;">Temps estimé : 24 à 48 heures</h3>
          <p style="color:#888;font-size:13px;margin:0;line-height:1.5;">Tu recevras un e-mail dès que ta routine sera disponible. Pas besoin de faire quoi que ce soit d'autre pour l'instant.</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- CTA -->
  <div style="background:white;border-radius:24px;padding:24px 28px;margin-bottom:28px;box-shadow:0 1px 4px rgba(0,0,0,0.06);text-align:center;">
    <p style="color:#555;font-size:14px;margin:0 0 16px;line-height:1.5;">En attendant, tu peux accéder à ton espace et découvrir le programme.</p>
    <a href="https://app.protocole-clear.com" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:9999px;font-size:15px;font-weight:600;letter-spacing:0.02em;">
      Accéder à mon espace →
    </a>
  </div>

  <!-- Footer -->
  <p style="text-align:center;color:#ccc;font-size:12px;line-height:1.6;margin:0;">
    Cet email a été envoyé via <strong style="color:#c4724b;">Protocole Clear</strong>.<br>
    Des questions ? Réponds directement à cet email.
  </p>

</div>
</body>
</html>`,
      )
    );

    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await step.run("notify-admin-intake", () =>
        sendEmail(
          adminEmail,
          `Nouveau bilan reçu — ${firstName}`,
          `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#111">
            <h1 style="font-size:22px;font-weight:700;margin:0 0 16px">Nouveau bilan peau soumis</h1>
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
              <tr><td style="padding:8px 0;color:#888;font-size:14px;width:120px;">Élève</td><td style="padding:8px 0;font-size:14px;font-weight:600;">${firstName}</td></tr>
              <tr><td style="padding:8px 0;color:#888;font-size:14px;">Email</td><td style="padding:8px 0;font-size:14px;">${email}</td></tr>
            </table>
            <a href="https://app.protocole-clear.com/admin/student/${uid}" style="display:inline-block;background:#c4724b;color:#fff;text-decoration:none;padding:12px 24px;border-radius:9999px;font-weight:600;font-size:14px;">
              Voir le profil élève →
            </a>
          </div>
          `,
        )
      );
    }
  },
);

// ── routine-followup ─────────────────────────────────────────────────────────
// Triggered when an admin assigns a routine. Sends a 7-day check-in email
// (the immediate routine notification is sent directly by the admin server fn).

export const routineNotification = inngest.createFunction(
  { id: "routine-followup", triggers: [{ event: "routine/assigned" }] },
  async ({ event, step }: { event: { data: UserPayload }; step: any }) => {
    const { email, firstName } = event.data;

    await step.sleep("wait-7-days", "7 days");

    await step.run("send-week1-checkin", () =>
      sendEmail(
        email,
        `${firstName}, une semaine avec ta routine — comment ça se passe ?`,
        `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#111">
          <h1 style="font-size:24px;font-weight:700;margin:0 0 12px">7 jours de routine, ${firstName} 🌟</h1>
          <p style="color:#555;line-height:1.6;margin:0 0 16px">
            Il y a une semaine, tu as reçu ta routine personnalisée. La régularité est la clé : même les petits changements quotidiens font une différence visible sur le long terme.
          </p>
          <p style="color:#555;line-height:1.6;margin:0 0 24px">
            Si tu as des questions sur un produit ou une étape, ton coach est disponible pour t'aider.
          </p>
          <a href="https://lumen.app/" style="display:inline-block;background:linear-gradient(135deg,#e879f9,#8b5cf6);color:#fff;text-decoration:none;padding:14px 28px;border-radius:9999px;font-weight:600;font-size:15px">
            Voir mon tableau de bord →
          </a>
        </div>
        `,
      )
    );
  },
);

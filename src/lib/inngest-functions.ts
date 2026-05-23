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

// ── welcome-sequence ─────────────────────────────────────────────────────────
// Sends a welcome email on sign-up, waits 3 days, then checks whether the user
// completed intake. If not, sends a reminder.

export const welcomeSequence = inngest.createFunction(
  { id: "welcome-sequence", triggers: [{ event: "user/signed.up" }] },
  async ({ event, step }: { event: { data: UserPayload }; step: any }) => {
    const { email, firstName } = event.data;

    await step.run("send-welcome-email", () =>
      sendEmail(
        email,
        `Bienvenue sur Protocole Clear, ${firstName} ✨`,
        `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#111">
          <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#e879f9,#8b5cf6);display:flex;align-items:center;justify-content:center;margin-bottom:24px">
            <span style="color:#fff;font-weight:700;font-size:18px">L</span>
          </div>
          <h1 style="font-size:28px;font-weight:700;margin:0 0 12px">Bienvenue sur Protocole Clear, ${firstName} 👋</h1>
          <p style="color:#555;line-height:1.6;margin:0 0 24px">
            Ton protocole Clear Skin de 12 semaines est maintenant activé. La prochaine étape : remplir ton bilan peau pour que nous puissions personnaliser chaque détail de ta routine.
          </p>
          <a href="https://lumen.app/intake" style="display:inline-block;background:linear-gradient(135deg,#e879f9,#8b5cf6);color:#fff;text-decoration:none;padding:14px 28px;border-radius:9999px;font-weight:600;font-size:15px">
            Remplir mon bilan peau →
          </a>
          <p style="color:#999;font-size:13px;margin-top:32px">
            Tu peux ignorer ce message si tu as déjà complété le bilan.
          </p>
        </div>
        `,
      )
    );

    await step.sleep("wait-3-days", "3 days");

    const intakeEvent = await step.waitForEvent("wait-for-intake", {
      event: "user/intake.completed",
      match: "data.uid",
      timeout: "1 day",
    });

    if (!intakeEvent) {
      await step.run("send-intake-reminder", () =>
        sendEmail(
          email,
          "Ton bilan peau t'attend 🌿",
          `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#111">
            <h1 style="font-size:24px;font-weight:700;margin:0 0 12px">Ton bilan peau t'attend, ${firstName}</h1>
            <p style="color:#555;line-height:1.6;margin:0 0 24px">
              Pour que ton protocole soit vraiment adapté à ta peau, nous avons besoin de tes réponses. Ça prend moins de 2 minutes.
            </p>
            <a href="https://lumen.app/intake" style="display:inline-block;background:linear-gradient(135deg,#e879f9,#8b5cf6);color:#fff;text-decoration:none;padding:14px 28px;border-radius:9999px;font-weight:600;font-size:15px">
              Compléter mon bilan →
            </a>
          </div>
          `,
        )
      );
    }
  },
);

// ── intake-confirmation ──────────────────────────────────────────────────────
// Sends a confirmation email immediately when a user submits their intake form.

export const intakeConfirmation = inngest.createFunction(
  { id: "intake-confirmation", triggers: [{ event: "user/intake.completed" }] },
  async ({ event, step }: { event: { data: UserPayload }; step: any }) => {
    const { uid, email, firstName } = event.data;

    await step.run("send-confirmation", () =>
      sendEmail(
        email,
        "Ton bilan peau a bien été reçu 🎉",
        `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#111">
          <h1 style="font-size:24px;font-weight:700;margin:0 0 12px">Bilan reçu, ${firstName} !</h1>
          <p style="color:#555;line-height:1.6;margin:0 0 24px">
            Nous avons bien reçu tes réponses. Ton coach va maintenant préparer ta routine AM/PM personnalisée — tu recevras une notification dès qu'elle sera prête.
          </p>
          <p style="color:#555;line-height:1.6;margin:0 0 24px">
            En attendant, tu peux commencer les leçons du protocole depuis ton tableau de bord.
          </p>
          <a href="https://app.protocole-clear.com/" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 28px;border-radius:9999px;font-weight:600;font-size:15px">
            Accéder à mon tableau de bord →
          </a>
        </div>
        `,
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

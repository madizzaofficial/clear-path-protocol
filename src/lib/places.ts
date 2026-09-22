import { getAdminDb } from "./firebase-admin";

// Capacité d'élèves par mois. Ajustable via la variable d'env PLACES_CAP sur Vercel.
const DEFAULT_CAP = 20;

/**
 * GET /api/public/places — compteur de places restantes pour la landing.
 * Rareté réelle : capacité mensuelle moins les paiements Stripe du mois en cours
 * (collection `payments`, alimentée par le webhook). Public, non sensible.
 */
export async function handlePlacesRequest(): Promise<Response> {
  try {
    const cap = Number(process.env.PLACES_CAP) || DEFAULT_CAP;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const snap = await getAdminDb()
      .collection("payments")
      .where("createdAt", ">=", monthStart.getTime())
      .count()
      .get();

    const places = Math.max(0, cap - snap.data().count);

    return new Response(JSON.stringify({ places, cap }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // La landing (protocole-clear.com) fetch cet endpoint cross-origin
        "Access-Control-Allow-Origin": "*",
        // Cache CDN 5 min — évite une lecture Firestore par visiteur
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (err) {
    console.error("[places] error:", err);
    return new Response(JSON.stringify({ error: "unavailable" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}

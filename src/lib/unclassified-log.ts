import { db } from "./firebase";
import { doc, setDoc, increment } from "firebase/firestore";
import type { AnalysisResultV2 } from "./cosmetic-ingredients";

type Ing = AnalysisResultV2["ingredients"][number];

// Log ingredients with no recognized role to Firestore so they can be reviewed
// and manually added to COMMON_INGREDIENTS or inferRoleFromName patterns.
// Fire-and-forget — never blocks the UI.
export function logUnclassifiedIngredients(ingredients: Ing[]): void {
  const unclassified = ingredients.filter((i) => i.flag === "ok" && !i.role);
  if (!unclassified.length) return;

  Promise.allSettled(
    unclassified.map((ing) => {
      if (!ing.normalized) return Promise.resolve();
      return setDoc(
        doc(db, "unclassified_ingredients", ing.normalized),
        {
          normalized: ing.normalized,
          raw: ing.raw,
          count: increment(1),
          lastSeen: Date.now(),
        },
        { merge: true }
      );
    })
  ).catch(() => {});
}

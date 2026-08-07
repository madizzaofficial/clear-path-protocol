// ponytail: check minimal du parcours — invariant "contigu depuis la semaine 1".
// Lancer : npx tsx src/lib/routine-phases.test.ts
import assert from "node:assert/strict";
import {
  defaultPhases,
  mergeWithNext,
  splitPhase,
  resequence,
  phaseForWeek,
  phaseForDay,
  lastWeek,
  phaseLabel,
  phaseIndexLabel,
  type RoutinePhase,
} from "./routine-phases";

/** L'invariant qui compte : les phases couvrent 1..N sans trou ni recouvrement. */
function assertContiguous(phases: RoutinePhase[], label: string) {
  let expected = 1;
  for (const p of phases) {
    assert.equal(p.fromWeek, expected, `${label}: trou/chevauchement à ${p.id}`);
    assert.ok(p.toWeek >= p.fromWeek, `${label}: phase inversée ${p.id}`);
    expected = p.toWeek + 1;
  }
}

// Parcours par défaut : 5 phases groupées couvrant 12 semaines.
const base = defaultPhases();
assert.equal(base.length, 5);
assert.equal(lastWeek(base), 12);
assertContiguous(base, "default");
// Vérifier les bornes exactes du défaut groupé.
assert.equal(base[0].fromWeek, 1); assert.equal(base[0].toWeek, 1);
assert.equal(base[1].fromWeek, 2); assert.equal(base[1].toWeek, 2);
assert.equal(base[2].fromWeek, 3); assert.equal(base[2].toWeek, 4);
assert.equal(base[3].fromWeek, 5); assert.equal(base[3].toWeek, 7);
assert.equal(base[4].fromWeek, 8); assert.equal(base[4].toWeek, 12);
// Les titres sont vides (auto) — l'UI affichera phaseIndexLabel + phaseLabel.
assert.equal(base[0].title, "");
assert.equal(base[0].description, "Tu démarres ta nouvelle routine.");

// Fusion : Phase 2 (S2) + Phase 3 (S3-4) → "Semaines 2-4", 4 phases au total.
const merged = mergeWithNext(base, 1);
assert.equal(merged.length, 4);
assert.equal(merged[1].title, "Semaines 2-4");
assert.equal(merged[1].fromWeek, 2);
assert.equal(merged[1].toWeek, 4);
assert.equal(merged[2].fromWeek, 5, "la phase suivante reprend en semaine 5");
assert.equal(lastWeek(merged), 12, "fusionner ne raccourcit pas le parcours");
assertContiguous(merged, "merge");

// Division : "Semaines 2-4" se recoupe → 5 phases au total.
const split = splitPhase(merged, 1);
assert.equal(split.length, 5);
assert.equal(split[1].toWeek, 3);
assert.equal(split[2].fromWeek, 4);
assertContiguous(split, "split");

// Les descriptions des deux phases fusionnées sont conservées, pas écrasées.
// On construit un parcours explicite de 3 phases pour ce test (defaultPhases
// retourne maintenant 5 phases, donc on ne peut plus s'en servir ici).
const withText: RoutinePhase[] = [
  { id: "t1", fromWeek: 1, toWeek: 1, title: "", description: "desc0" },
  { id: "t2", fromWeek: 2, toWeek: 2, title: "", description: "desc1" },
  { id: "t3", fromWeek: 3, toWeek: 3, title: "", description: "desc2" },
];
const mergedText = mergeWithNext(withText, 0);
assert.ok(mergedText[0].description.includes("desc0"));
assert.ok(mergedText[0].description.includes("desc1"));

// Un titre personnalisé survit au re-séquençage ; un titre auto est recalculé.
const custom: RoutinePhase[] = [
  { id: "a", fromWeek: 1, toWeek: 1, title: "Phase d'attaque", description: "" },
  { id: "b", fromWeek: 5, toWeek: 6, title: phaseLabel(5, 6), description: "" },
];
const reseq = resequence(custom);
assert.equal(reseq[0].title, "Phase d'attaque", "titre personnalisé préservé");
assert.equal(reseq[1].fromWeek, 2, "la phase suivante est recollée");
assert.equal(reseq[1].title, "Semaines 2-3", "titre auto recalculé sur les nouvelles bornes");
assertContiguous(reseq, "resequence");

// Régression : un titre auto rendu périmé par un changement de durée doit être
// recalculé, pas figé. Sinon le badge affiche "Semaines 1-3" et l'élève lit
// "Semaines 1-2" juste en dessous.
const stale = resequence([
  { id: "s1", fromWeek: 1, toWeek: 3, title: "Semaines 1-2", description: "" },
  { id: "s2", fromWeek: 4, toWeek: 4, title: "Semaine 4", description: "" },
]);
assert.equal(stale[0].title, "Semaines 1-3", "titre auto périmé recalculé");
assert.equal(stale[1].title, "Semaine 4");

// Un titre personnalisé n'est jamais écrasé, ni par une fusion ni par une division.
const named: RoutinePhase[] = [
  { id: "n1", fromWeek: 1, toWeek: 2, title: "Phase d'attaque", description: "" },
  { id: "n2", fromWeek: 3, toWeek: 4, title: "Semaines 3-4", description: "" },
];
assert.equal(mergeWithNext(named, 0)[0].title, "Phase d'attaque");
assert.equal(splitPhase(named, 0)[0].title, "Phase d'attaque");

// Phase actuelle selon le jour du protocole : S1, S2-3, S4-6.
const parcours = resequence([
  { id: "p1", fromWeek: 1, toWeek: 1, title: "", description: "" },
  { id: "p2", fromWeek: 1, toWeek: 2, title: "", description: "" },
  { id: "p3", fromWeek: 1, toWeek: 3, title: "", description: "" },
]);
assert.deepEqual(
  parcours.map((p) => phaseLabel(p.fromWeek, p.toWeek)),
  ["Semaine 1", "Semaines 2-3", "Semaines 4-6"],
);
assert.equal(phaseForDay(parcours, 1)?.id, "p1", "jour 1 → Semaine 1");
assert.equal(phaseForDay(parcours, 7)?.id, "p1", "jour 7 → encore Semaine 1");
assert.equal(phaseForDay(parcours, 8)?.id, "p2", "jour 8 → Semaines 2-3");
assert.equal(phaseForDay(parcours, 21)?.id, "p2", "jour 21 → fin de Semaines 2-3");
assert.equal(phaseForDay(parcours, 22)?.id, "p3", "jour 22 → Semaines 4-6");
assert.equal(phaseForDay(parcours, 500)?.id, "p3", "au-delà du parcours → dernière phase");

// Recherche par semaine.
assert.equal(phaseForWeek(merged, 3)?.id, merged[1].id);
assert.equal(phaseForWeek(merged, 99), undefined);

// phaseIndexLabel : "Phase 1", "Phase 2", …
assert.equal(phaseIndexLabel(0), "Phase 1");
assert.equal(phaseIndexLabel(4), "Phase 5");

console.log("routine-phases: OK");

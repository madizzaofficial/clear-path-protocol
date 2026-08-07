# Design : Phases éditables (édition admin + parcours élève)

**Date** : 2026-08-07
**Statut** : Validé par l'utilisateur, en attente de plan d'implémentation

## Problème

Le système de phases existe déjà (`src/lib/routine-phases.ts`) et supporte le
regroupement de semaines (input « Durée » + boutons fusionner/diviser). Mais
deux problèmes persistent :

1. **Éditeur admin (screen 1)** — `src/components/PhaseEditor.tsx` : le tag rose
   de chaque carte affiche `phaseLabel(fromWeek, toWeek)` → « Semaine 1 »,
   « Semaines 2-3 ». Comme `defaultPhases()` crée **12 phases d'une semaine**,
   l'éditeur ressemble à une liste de semaines, pas de phases. L'admin ne voit
   pas qu'il manipule des phases.

2. **Parcours élève (screen 2)** — `src/routes/suivi.tsx` : la liste affiche
   `phase.title || phaseLabel(...)` sans distinguer « Phase N » de la plage de
   semaines. Le badge du hero (`Phase {currentPhase.id}/6`, ligne 582) est cassé :
   `currentPhase.id` est une chaîne (ex. `w3`, `p…`), pas un index 1–6.

L'utilisateur veut :
- Des **phases** clairement identifiées comme telles, à l'intérieur desquelles
  on indique les semaines concernées (« Semaine 1 », « Semaines 2-3 »,
 « Semaines 3-5 »).
- La **description de phase** sous la ligne « Phase N + semaines ».
- Un **défaut groupé** (~5 phases) plutôt que 12 semaines séparées, comme
  l'ancienne version fixe (commit `248341c`, `JOURNEY_PHASES`).

## Approche retenue

**Approche A — Présentation + défaut, sans migration** (recommandée et validée).

- Changer le tag de l'éditeur pour « Phase N » + plage en sous-titre.
- Réécrire `defaultPhases()` pour produire ~5 phases contiguës couvrant 12
  semaines, avec descriptions par défaut.
- Mettre à jour le parcours pour afficher « Phase N + plage + titre +
  description » et corriger le badge hero.
- **Aucune migration** : les élèves dont le parcours a déjà été sauvegardé le
  gardent tel quel ; seuls ceux sans parcours personnalisé bénéficient du
  nouveau défaut.

Approche B (migration des routines existantes) écartée : elle écraserait le
travail admin déjà fait sans bénéfice clair.

## Changements détaillés

### 1. `src/lib/routine-phases.ts`

**Nouvelle fonction** :
```ts
/** Libellé « Phase N » pour l'index 0-based `i`. */
export function phaseIndexLabel(i: number): string {
  return `Phase ${i + 1}`;
}
```

**Réécriture de `defaultPhases()`** : retourne 5 phases contiguës couvrant
12 semaines, avec descriptions par défaut inspirées de l'ancien `JOURNEY_PHASES` :

| Index | Phase | Semaines | Description par défaut |
|---|---|---|---|
| 0 | Phase 1 | Semaine 1 | Tu démarres ta nouvelle routine. |
| 1 | Phase 2 | Semaine 2 | Ta peau s'adapte à la routine. |
| 2 | Phase 3 | Semaines 3-4 | La purge peut commencer, sois patient. |
| 3 | Phase 4 | Semaines 5-7 | La purge se calme, la peau commence à s'habituer. |
| 4 | Phase 5 | Semaines 8-12 | La peau s'éclaircit, les résultats se confirment. |

- Les `id` restent stables (`p1`…`p5`).
- Les `title` sont laissés vides (`""`) — ce sont des titres auto : l'UI affichera
  « Phase N » comme label principal et `phaseLabel(fromWeek, toWeek)` comme
  plage. Laisser `title` vide évite qu'un titre par défaut figé ne survive à un
  re-séquençage ultérieur (cf. `isAutoTitle`).
- `DEFAULT_PHASE_COUNT` reste exporté pour compat (utilisé par `products.tsx`
  via `lastWeek`), mais `defaultPhases()` ignore désormais son argument (ou
  l'accepte sans effet) — le défaut est toujours 5 phases sur 12 semaines.

**Note** : `phaseLabel`, `isAutoTitle`, `resequence`, `mergeWithNext`,
`splitPhase`, `phaseDayRange`, `phaseForDay`, `phaseForWeek`, `lastWeek`,
`stepsStartingInPhase` sont inchangés.

### 2. `src/components/PhaseEditor.tsx` (screen 1)

Carte de phase (lignes 79–168) :

- **Tag rose** (lignes 88–90) : afficher `Phase {i+1}` au lieu de
  `phaseLabel(phase.fromWeek, phase.toWeek)`.
- **Sous-titre plage** : nouvelle ligne sous le tag, en texte muted petit,
  affichant `phaseLabel(phase.fromWeek, phase.toWeek)` (ex. « Semaine 1 »,
  « Semaines 2-3 »).
- Input « Durée », boutons fusionner/diviser/supprimer, titre, description,
  produits : **inchangés**.
- Texte d'instruction (lignes 74–77) : inchangé, déjà correct.

Disposition suggérée du header de carte :
```
[Phase 1]  Semaine 1              Durée [1] sem.  ⛓ ✂ 🗑
```
où « Semaine 1 » est en muted petit à côté du tag rose « Phase 1 ».

### 3. `src/routes/suivi.tsx` (screen 2)

**Hero badge** (ligne 582) :
- Remplacer `Phase {currentPhase.id}/6` par
  `Phase {currentPhaseIndex + 1}/{journey.length}`.
- Calculer `currentPhaseIndex` : index de la phase courante dans `journeyRanges`
  (trouvé via `phaseForDay` ou en repérant l'entrée `isCurrent`). À calculer une
  fois après `journeyRanges` (autour de la ligne 446) et réutiliser dans le hero
  et la liste.

**Liste parcours** (lignes 918–968) : chaque ligne affiche :
- Cercle avec `i+1` (inchangé).
- **Ligne 1** : `Phase {i+1}` (gras) + `phaseLabel(fromWeek, toWeek)` (muted)
  + tag « Phase actuelle » si `isCurrent`.
- **Ligne 2** : `phase.title` (gras moyen) — uniquement si `phase.title` est
  non vide et différent du label de plage (pour éviter la redondance).
- **Ligne 3** : `phase.description` (muted) — inchangé.

Rendu cible :
```
●  Phase 3   Semaines 3-4   Phase actuelle
     La purge peut commencer
     [description plus longue si présente]
```

Past/future : conserver la logique `isPast`/`isCurrent` et les classes
`opacity-50`/`opacity-35`/`bg-primary-soft` existantes.

### 4. `src/lib/routine-phases.test.ts`

Mettre à jour les assertions qui dépendent de l'ancien défaut 12×1 :

- `base = defaultPhases()` : `base.length` devient 5, `lastWeek(base)` reste 12.
- `assertContiguous(base, "default")` : toujours vrai.
- Le test « Fusion : semaine 2 + semaine 3 » (`mergeWithNext(base, 1)`) doit
  être ajusté : avec 5 phases par défaut, fusionner l'index 1 (Phase 2 = S2)
  avec l'index 2 (Phase 3 = S3-4) donne une phase « Semaines 2-4 » et 4 phases
  au total. Adapter les assertions sur `merged[1].title`, `fromWeek`, `toWeek`,
  `merged[2].fromWeek`, `lastWeek(merged)`.
- Le test « Division » (`splitPhase(merged, 1)`) : adapter à la nouvelle
  structure.
- Les tests sur `withText`, `custom`, `stale`, `named`, `parcours` (qui
  construisent leurs propres phases) restent valides ; vérifier seulement
  `defaultPhases(3)` (utilisé pour `withText`) — désormais `defaultPhases(3)`
  retourne aussi 5 phases (le count est ignoré). Adapter si besoin, ou
  construire `withText` à partir d'un parcours explicite de 3 phases pour
  préserver l'intention du test.

Ajouter un test : `defaultPhases()` retourne bien 5 phases contiguës couvrant
1..12, avec les bornes attendues (1, 2, 3-4, 5-7, 8-12).

## Out of scope

- `src/routes/products.tsx` : inchangé. Il utilise `lastWeek(phases)` pour la
  durée totale et un sélecteur de semaine plat — pas concerné par le
  regroupement de phases.
- `src/lib/routine-week.ts` : inchangé (legacy, cap à 12).
- `src/routes/admin_.student.$uid.tsx` : inchangé (setter de date de début).
- Migration des routines Firestore existantes : non. Les parcours déjà
  sauvegardés (12 phases d'1 semaine ou autre) restent tels quels ; l'admin
  peut les regrouper manuellement.

## Risques

- **Régression visuelle parcours** : les élèves avec un parcours déjà
  sauvegardé en 12 phases verront toujours 12 lignes « Phase N / Semaine N ».
  C'est acceptable et attendu (pas de migration).
- **Badge hero** : s'assurer que `currentPhaseIndex` est bien défini même quand
  `journey` est vide (fallback `defaultPhases()` garantit non-vide, mais
  défensivement `currentPhaseIndex ?? 0`).
- **Tests** : le test `withText = defaultPhases(3).map(...)` change de
  longueur (5 au lieu de 3) ; adapter pour ne pas casser l'assertion sur
  `mergeWithNext(withText, 0)`.
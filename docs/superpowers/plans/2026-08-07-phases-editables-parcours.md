# Phases éditables — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make phases clearly identifiable as "Phase N" (not "Semaine N") in the admin editor and student journey, and change the default parcours from 12 single-week phases to 5 grouped phases.

**Architecture:** Four files touched — the shared phase library (`routine-phases.ts`), the admin editor component (`PhaseEditor.tsx`), the student journey route (`suivi.tsx`), and the test file. No Firestore migration; existing saved parcours are preserved as-is.

**Tech Stack:** TypeScript, React, TanStack Start, Tailwind CSS v4, Firestore (no schema change)

## Global Constraints

- No Firestore migration — existing `phases[]` arrays in `routines/{uid}` are left untouched
- `defaultPhases()` must always produce 5 phases covering weeks 1–12 contiguously
- `phaseLabel()` and `isAutoTitle()` behavior unchanged
- All existing tests must pass after changes
- French-language UI (labels, descriptions)

---

### Task 1: Add `phaseIndexLabel` and rewrite `defaultPhases()`

**Files:**
- Modify: `src/lib/routine-phases.ts`

**Interfaces:**
- Produces: `phaseIndexLabel(i: number): string` — returns `"Phase ${i+1}"`
- Produces: `defaultPhases()` — now returns 5 grouped phases (ignores `count` param, keeps signature for compat)

- [ ] **Step 1: Add `phaseIndexLabel` function**

Add after the `phaseLabel` function (after line 29):

```ts
/** Libellé « Phase N » pour l'index 0-based `i`. */
export function phaseIndexLabel(i: number): string {
  return `Phase ${i + 1}`;
}
```

- [ ] **Step 2: Rewrite `defaultPhases()`**

Replace the existing `defaultPhases` function (lines 33–41) with:

```ts
/** Parcours par défaut : 5 phases contiguës couvrant 12 semaines, avec
 *  descriptions par défaut. Utilisé quand un élève n'a pas encore de
 *  parcours personnalisé. Le paramètre `count` est ignoré (gardé pour
 *  compatibilité d'interface). */
export function defaultPhases(_count: number = DEFAULT_PHASE_COUNT): RoutinePhase[] {
  return [
    { id: "p1", fromWeek: 1, toWeek: 1,  title: "", description: "Tu démarres ta nouvelle routine." },
    { id: "p2", fromWeek: 2, toWeek: 2,  title: "", description: "Ta peau s'adapte à la routine." },
    { id: "p3", fromWeek: 3, toWeek: 4,  title: "", description: "La purge peut commencer, sois patient." },
    { id: "p4", fromWeek: 5, toWeek: 7,  title: "", description: "La purge se calme, la peau commence à s'habituer." },
    { id: "p5", fromWeek: 8, toWeek: 12, title: "", description: "La peau s'éclaircit, les résultats se confirment." },
  ];
}
```

- [ ] **Step 3: Verify the file compiles**

Run: `npx tsc --noEmit src/lib/routine-phases.ts 2>&1 | head -20`
Expected: no errors (may show unrelated project-wide errors — focus on `routine-phases.ts` only)

- [ ] **Step 4: Commit**

```bash
git add src/lib/routine-phases.ts
git commit -m "feat(phases): add phaseIndexLabel, rewrite defaultPhases to 5 grouped phases"
```

---

### Task 2: Update tests for new `defaultPhases()`

**Files:**
- Modify: `src/lib/routine-phases.test.ts`

**Interfaces:**
- Consumes: `defaultPhases()` (now returns 5 phases), `phaseIndexLabel` (new export)
- Produces: updated assertions matching new default

- [ ] **Step 1: Add import for `phaseIndexLabel`**

Change line 12 from:
```ts
  phaseLabel,
```
to:
```ts
  phaseLabel,
  phaseIndexLabel,
```

- [ ] **Step 2: Update default phases assertions (lines 27–30)**

Replace:
```ts
// Parcours par défaut : 12 semaines individuelles.
const base = defaultPhases();
assert.equal(base.length, 12);
assert.equal(lastWeek(base), 12);
assertContiguous(base, "default");
```
with:
```ts
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
```

- [ ] **Step 3: Update merge test (lines 32–40)**

Replace:
```ts
// Fusion : semaine 2 + semaine 3 → "Semaines 2-3", le reste se décale.
const merged = mergeWithNext(base, 1);
assert.equal(merged.length, 11);
assert.equal(merged[1].title, "Semaines 2-3");
assert.equal(merged[1].fromWeek, 2);
assert.equal(merged[1].toWeek, 3);
assert.equal(merged[2].fromWeek, 4, "la phase suivante reprend en semaine 4");
assert.equal(lastWeek(merged), 12, "fusionner ne raccourcit pas le parcours");
assertContiguous(merged, "merge");
```
with:
```ts
// Fusion : Phase 2 (S2) + Phase 3 (S3-4) → "Semaines 2-4", 4 phases au total.
const merged = mergeWithNext(base, 1);
assert.equal(merged.length, 4);
assert.equal(merged[1].title, "Semaines 2-4");
assert.equal(merged[1].fromWeek, 2);
assert.equal(merged[1].toWeek, 4);
assert.equal(merged[2].fromWeek, 5, "la phase suivante reprend en semaine 5");
assert.equal(lastWeek(merged), 12, "fusionner ne raccourcit pas le parcours");
assertContiguous(merged, "merge");
```

- [ ] **Step 4: Update split test (lines 43–47)**

Replace:
```ts
// Division : "Semaines 2-3" se recoupe en deux semaines simples.
const split = splitPhase(merged, 1);
assert.equal(split.length, 12);
assert.equal(split[1].toWeek, 2);
assert.equal(split[2].fromWeek, 3);
assertContiguous(split, "split");
```
with:
```ts
// Division : "Semaines 2-4" se recoupe → 5 phases au total.
const split = splitPhase(merged, 1);
assert.equal(split.length, 5);
assert.equal(split[1].toWeek, 2);
assert.equal(split[2].fromWeek, 3);
assertContiguous(split, "split");
```

- [ ] **Step 5: Update `withText` test (lines 50–53)**

Replace:
```ts
// Les descriptions des deux phases fusionnées sont conservées, pas écrasées.
const withText = defaultPhases(3).map((p, i) => ({ ...p, description: `desc${i}` }));
const mergedText = mergeWithNext(withText, 0);
assert.ok(mergedText[0].description.includes("desc0"));
assert.ok(mergedText[0].description.includes("desc1"));
```
with:
```ts
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
```

- [ ] **Step 6: Add `phaseIndexLabel` test**

Add before the final `console.log` line:

```ts
// phaseIndexLabel : "Phase 1", "Phase 2", …
assert.equal(phaseIndexLabel(0), "Phase 1");
assert.equal(phaseIndexLabel(4), "Phase 5");
```

- [ ] **Step 7: Run tests**

Run: `npx tsx src/lib/routine-phases.test.ts`
Expected: `routine-phases: OK` (no assertion errors)

- [ ] **Step 8: Commit**

```bash
git add src/lib/routine-phases.test.ts
git commit -m "test(phases): update tests for 5-phase default and phaseIndexLabel"
```

---

### Task 3: Update PhaseEditor to show "Phase N" tag + plage subtitle

**Files:**
- Modify: `src/components/PhaseEditor.tsx`

**Interfaces:**
- Consumes: `phaseIndexLabel` from `@/lib/routine-phases` (new import)
- Produces: updated card header with "Phase N" tag + "Semaine X" / "Semaines X-Y" subtitle

- [ ] **Step 1: Add `phaseIndexLabel` to imports**

Change line 6 from:
```ts
  phaseLabel,
```
to:
```ts
  phaseLabel,
  phaseIndexLabel,
```

- [ ] **Step 2: Replace the tag and add plage subtitle in the phase card**

Replace lines 86–90:
```tsx
              <div key={phase.id} className="rounded-2xl border border-border/60 bg-background p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                    {phaseLabel(phase.fromWeek, phase.toWeek)}
                  </span>
```
with:
```tsx
              <div key={phase.id} className="rounded-2xl border border-border/60 bg-background p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                    {phaseIndexLabel(i)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {phaseLabel(phase.fromWeek, phase.toWeek)}
                  </span>
```

- [ ] **Step 3: Verify the file compiles**

Run: `npx tsc --noEmit src/components/PhaseEditor.tsx 2>&1 | head -20`
Expected: no errors specific to PhaseEditor.tsx

- [ ] **Step 4: Commit**

```bash
git add src/components/PhaseEditor.tsx
git commit -m "feat(PhaseEditor): show Phase N tag with week range subtitle"
```

---

### Task 4: Update suivi.tsx — hero badge + parcours list

**Files:**
- Modify: `src/routes/suivi.tsx`

**Interfaces:**
- Consumes: `phaseIndexLabel` from `@/lib/routine-phases` (new import)
- Produces: corrected hero badge, updated parcours list with "Phase N + plage + title + description"

- [ ] **Step 1: Add `phaseIndexLabel` to imports**

Change line 18 from:
```ts
import { defaultPhases, phaseDayRange, phaseLabel, type RoutinePhase } from "@/lib/routine-phases";
```
to:
```ts
import { defaultPhases, phaseDayRange, phaseIndexLabel, phaseLabel, type RoutinePhase } from "@/lib/routine-phases";
```

- [ ] **Step 2: Compute `currentPhaseIndex` after `journeyRanges`**

After line 443 (`});`), add:

```ts
  const currentPhaseIndex = journeyRanges.findIndex(
    (r) => dayCount >= r.dayStart && dayCount <= r.dayEnd,
  );
```

- [ ] **Step 3: Fix hero badge (line 582)**

Replace:
```tsx
                Phase {currentPhase.id}/6
```
with:
```tsx
                {phaseIndexLabel(currentPhaseIndex >= 0 ? currentPhaseIndex : journey.length - 1)}/{journey.length}
```

- [ ] **Step 4: Update parcours list display (lines 946–964)**

Replace lines 946–964:
```tsx
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm font-medium ${isCurrent ? "text-foreground" : ""}`}
                          >
                            {phase.title || phaseLabel(phase.fromWeek, phase.toWeek)}
                          </p>
                          {isCurrent && (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold text-primary-foreground">
                              Phase actuelle
                            </span>
                          )}
                        </div>
                        {phase.description && (
                          <p
                            className={`mt-0.5 text-xs ${isCurrent ? "text-foreground/70" : "text-muted-foreground"}`}
                          >
                            {phase.description}
                          </p>
                        )}
```
with:
```tsx
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm font-medium ${isCurrent ? "text-foreground" : ""}`}
                          >
                            {phaseIndexLabel(i)}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {phaseLabel(phase.fromWeek, phase.toWeek)}
                          </span>
                          {isCurrent && (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold text-primary-foreground">
                              Phase actuelle
                            </span>
                          )}
                        </div>
                        {phase.title &&
                          phase.title !== phaseLabel(phase.fromWeek, phase.toWeek) && (
                            <p
                              className={`mt-0.5 text-sm font-medium ${isCurrent ? "text-foreground/80" : ""}`}
                            >
                              {phase.title}
                            </p>
                          )}
                        {phase.description && (
                          <p
                            className={`mt-0.5 text-xs ${isCurrent ? "text-foreground/70" : "text-muted-foreground"}`}
                          >
                            {phase.description}
                          </p>
                        )}
```

- [ ] **Step 5: Verify the file compiles**

Run: `npx tsc --noEmit src/routes/suivi.tsx 2>&1 | head -20`
Expected: no errors specific to suivi.tsx

- [ ] **Step 6: Commit**

```bash
git add src/routes/suivi.tsx
git commit -m "feat(suivi): show Phase N + week range in parcours list, fix hero badge"
```

---

### Task 5: Integration verification

**Files:**
- Verify: `src/lib/routine-phases.ts`, `src/components/PhaseEditor.tsx`, `src/routes/suivi.tsx`, `src/lib/routine-phases.test.ts`

- [ ] **Step 1: Run full test suite**

Run: `npx tsx src/lib/routine-phases.test.ts`
Expected: `routine-phases: OK`

- [ ] **Step 2: Type-check all changed files**

Run: `npx tsc --noEmit 2>&1 | grep -E "(routine-phases|PhaseEditor|suivi)" | head -20`
Expected: no output (no errors in our files)

- [ ] **Step 3: Start dev server and spot-check**

Run: `npm run dev` (in background)
- Open `/admin/routines?uid=<test-student>` — verify each phase card shows "Phase 1", "Phase 2"… with "Semaine X" / "Semaines X-Y" subtitle
- Open `/suivi` as the test student — verify hero badge shows "Phase N/5", parcours list shows "Phase N + Semaines X-Y + description"
- Verify past phases show green checkmark, current phase shows orange highlight + "Phase actuelle" tag

- [ ] **Step 4: Commit any final tweaks**

```bash
git add -A
git commit -m "chore: final integration verification for phases redesign"
```

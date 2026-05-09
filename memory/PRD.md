## Lumen — Clear Skin Protocol (PRD)

### Original Problem Statement
User cloned `https://github.com/madizzaofficial/clear-path-protocol.git` (Lovable-built UI in TanStack Start + React 19 + Tailwind v4 + shadcn). Goal: keep Lovable's beautiful artistic direction and add real backend + Firebase + the "next steps" Lovable suggested.

### Architecture
- **Frontend**: TanStack Start (Vite + React 19 + TS + Tailwind v4 + shadcn/ui), port 3000.
- **Backend**: FastAPI on port 8001 with `firebase-admin` (token verification, Firestore, Storage).
- **Firebase**: project `methode-clear` (Auth Email/Password + Google, Firestore, Storage).
- **Routes**: `/api/*` proxied via Kubernetes ingress.

### Personas
1. **Student** (`is_admin: false`): follows the 12-week protocol. Submits intake quiz, uploads weekly progress photos, daily check-ins, watches lessons, follows coach-published routine.
2. **Coach / Admin** (`is_admin: true`): the course owner. Reviews student intakes, builds and publishes per-student routines, monitors photos and check-ins, leaves private notes.

### Core Requirements
- Lovable's artistic direction preserved (Fraunces+Inter, terracotta/cream palette, rounded-3xl cards, gradient warm).
- Auth: Firebase email/password + Google.
- **Coach-curated** routine: student fills intake → coach reviews → publishes routine → student sees it.
- Progress photo journal with weekly comparison.
- Affiliate revenue per recommended product.
- Admin coach dashboard with full per-student drill-down.

### What's Implemented
**Iteration 1 — Foundation**
- Firebase Auth (Email/Password + Google) wired into Lovable's `/login` and `/register`.
- Firestore `users/{uid}` doc auto-bootstrap on first auth.
- Protected routes + role-aware nav.
- 6-step intake quiz at `/intake`.
- Progress photo journal at `/progress` (Firebase Storage uploads + timeline).
- Sign-out + user menu.

**Iteration 2 — Affiliate + Admin Detail**
- Affiliate links per product (Amazon search + optional `VITE_AMAZON_AFFILIATE_TAG`); FTC disclosure footnote.
- Admin student detail page `/admin/students/$uid` with tabs: Overview / Intake / Photos / Check-ins / Notes.
- Smart "days since last check-in" warning (red >5d).
- Fixed TanStack route nesting bug (`admin.tsx` → `admin.index.tsx`).

**Iteration 3 — `is_admin` + Routine Builder workflow**
- Switched admin gating to Firestore boolean `is_admin: true` (legacy `role: "admin"` still accepted).
- Helper script `/app/backend/scripts/set_admin.py` to promote/revoke.
- **Decoupled intake from routine**: intake POST stores answers only; new collection `users/{uid}/routine/current` with `status: "pending" | "published"`.
- `/products`: 3 states — no-intake CTA / "Your routine is being prepared" banner / published routine with affiliate buttons.
- New **Routine** tab on admin student detail with full editor:
  - Editable AM/PM blocks (title, subtitle, total minutes)
  - Per-step fields: category (select), product name, brand, image URL, affiliate URL, description, amount, frequency, how-to
  - "Generate draft from intake" (rule-based starter), Save draft, Publish, Unpublish
  - Reorder + remove steps, add new product
  - Editable rationale (one reason per line)
- `/api/admin/promote` now uses `{uid, is_admin: bool}`.

### Backend Endpoints
**Public/Auth**
- `GET /api/health` · `GET /api/auth/me` · `POST /api/auth/bootstrap`

**Student**
- `POST /api/intake` · `GET /api/intake`
- `GET /api/routine`
- `POST /api/checkins` · `GET /api/checkins`
- `POST /api/photos` · `GET /api/photos`

**Admin (`is_admin: true`)**
- `GET /api/admin/students` · `GET /api/admin/students/{uid}`
- `PUT /api/admin/students/{uid}/routine` · `POST .../publish` · `POST .../unpublish` · `POST .../draft`
- `POST /api/admin/notes` · `POST /api/admin/promote`

### Tests
- 35/35 backend (`test_lumen_api.py`, `test_lumen_iter2.py`, `test_lumen_iter4.py`)
- All critical frontend flows pass (login/register, signup → intake → preparing banner, admin builds routine + publishes, student sees published routine + affiliate buttons, unpublish reverts, role gating, nav visibility)

### Prioritized Backlog
**P0 — next:**
- **Email notifications**: SendGrid or Resend, send "your routine is ready" when admin publishes; "lesson unlocked"; "missed check-in" reminders.
- **Daily check-in widget** on dashboard + skin-score graph (recharts) over 12 weeks.
- **Photo upload to Firebase Storage from admin** (so coach can attach images to products without searching for URLs).

**P1:**
- 1:1 messaging student ↔ coach (Firestore `messages` subcollection).
- Photo review queue (admin) + smart alerts (no check-in 5d, 3 bad days).
- Product catalog (admin) so the routine builder has a searchable library.
- Drag-and-drop reordering for routine steps (currently up/down buttons).

**P2:**
- Stripe subscriptions (pause/cancel/upgrade) — user said "later".
- Cohort/batch view + revenue analytics (MRR/churn/LTV/affiliate clicks).
- Certificate at week 12 (shareable).
- Coach note templates & audit log.

### Known Tech Debt
- `server.py` (~535 lines) — split into `auth/`, `intake/`, `routine/`, `admin/` routers.
- `CORS_ORIGINS=*` + `allow_credentials=True` is loose; tighten before prod.
- `/api/intake` overwrites without history; consider versioning subcollection.
- `course-data.ts` is still static — chapters/lessons should move to Firestore so admin can manage content.

### Last Updated
2026-05-09 — Iteration 3 complete (is_admin gating + coach-curated routine builder).

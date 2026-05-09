## Lumen — Clear Skin Protocol (PRD)

### Original Problem Statement
User cloned `https://github.com/madizzaofficial/clear-path-protocol.git` (Lovable-built UI in TanStack Start + React 19 + Tailwind v4 + shadcn). They want to keep Lovable's beautiful artistic direction and add real backend + Firebase + the "next steps" Lovable suggested.

### Architecture
- **Frontend**: TanStack Start (Vite + React 19 + TS + Tailwind v4 + shadcn/ui), runs on port 3000 via supervisor (`yarn start` → `vite dev`).
- **Backend**: FastAPI (Python) on port 8001. Uses `firebase-admin` to verify Firebase ID tokens and read/write Firestore + Storage.
- **DB & Auth & Storage**: Firebase project `methode-clear` (Firestore, Auth Email/Password + Google, Cloud Storage).
- **Routing**: All backend endpoints prefixed `/api/*` and proxied through Kubernetes ingress.

### User Personas
1. **Student** (default `role: "student"`): user following the 12-week protocol. Submits intake quiz, uploads weekly progress photos, daily check-ins, watches lessons, follows AM/PM routine.
2. **Coach / Admin** (`role: "admin"`): the course owner. Sees all students, drills into individual profiles (intake answers, photos, check-ins), leaves private notes.

### Core Requirements (static)
- Premium artistic direction must be preserved exactly as Lovable designed it (Fraunces+Inter, terracotta/cream palette, rounded-3xl cards, gradient warm hero blocks).
- Auth: Firebase email/password + Google sign-in.
- Personalized routine generated from intake quiz answers (rule-based for now; LLM-upgrade later).
- Progress photo journal with weekly comparison.
- Admin coach dashboard with student drill-down + private notes.
- Affiliate revenue per recommended product.

### What's Implemented
**Iteration 1 — May 2026**
- ✅ Full Firebase integration: client SDK + admin SDK, ID-token-protected endpoints.
- ✅ Email/password & Google sign-in on `/login` and `/register` (Lovable visuals preserved).
- ✅ Auto-bootstrap of Firestore `users/{uid}` doc on first auth.
- ✅ Protected routes (`/`, `/course`, `/products`, `/lesson/$id`, `/progress`, `/admin`).
- ✅ 6-step intake quiz at `/intake` → POST `/api/intake` → personalized AM/PM routine generated server-side and stored at `users/{uid}/intake/current` + on user doc.
- ✅ Progress photo journal at `/progress`: upload to Firebase Storage (`progress/{uid}/week-N/...`) + Firestore metadata via `/api/photos`.
- ✅ Sign-out, user menu with initials, week badge.
- ✅ Admin dashboard at `/admin` (admin-only) wired to live Firestore via `/api/admin/students`.

**Iteration 2 — May 2026**
- ✅ **Affiliate links per product** on `/products` (Amazon search + optional `VITE_AMAZON_AFFILIATE_TAG`). Each step shows a "Shop this product" CTA opening in new tab with `rel="sponsored noopener noreferrer"`. Disclosure footnote added.
- ✅ **Admin student detail page** `/admin/students/$uid` with 5 tabs: Overview / Intake / Photos / Check-ins / Notes. Coach can write private notes per student (POST /api/admin/notes). "View" link added on each row in /admin.
- ✅ Smart "days since last check-in" warning (red when >5 days).
- ✅ Fixed TanStack file-based route nesting bug (renamed `admin.tsx` → `admin.index.tsx`).

### Backend Endpoints
- `GET /api/health`
- `GET /api/auth/me` (auth) · `POST /api/auth/bootstrap` (auth, idempotent)
- `POST /api/intake` · `GET /api/intake` (auth) — routine includes `affiliateUrl` per step
- `POST /api/checkins` · `GET /api/checkins` (auth)
- `POST /api/photos` · `GET /api/photos` (auth)
- `GET /api/admin/students` (admin)
- `GET /api/admin/students/{uid}` (admin) — returns profile + intake + photos + checkins + notes
- `POST /api/admin/notes` (admin)
- `POST /api/admin/promote` (admin)

### Tests
- 19/19 backend tests pass (`/app/backend/tests/test_lumen_api.py`, `test_lumen_iter2.py`)
- All critical frontend flows pass (login, register, signup → intake → routine, photo upload, admin list → student detail → notes, sign-out, role gating)

### Prioritized Backlog
**P0 — next iteration:**
- Daily check-in widget on dashboard + skin-score graph (recharts).
- Routine builder UI (drag-and-drop AM/PM steps from a product catalog) — admin can override the generated routine per student.
- Coach can edit `week` & assign custom routine on the student detail page.

**P1:**
- 1:1 messaging student ↔ coach (Firestore subcollection `users/{uid}/messages`).
- Photo review queue (admin) + smart alerts (no check-in 5d, 3 bad days).
- Product catalog CRUD (admin) — replace static course-data.ts.
- Email/push notifications (Firebase Cloud Messaging or Resend).

**P2:**
- Stripe subscriptions (pause/cancel/upgrade).
- Cohort/batch view + revenue analytics (MRR/churn/LTV).
- Certificate at week 12 (shareable).
- Coach note templates & audit log.

### Known Tech Debt
- `server.py` is a single ~430-line file → should be split into routers (`auth/`, `intake/`, `photos/`, `admin/`).
- `CORS_ORIGINS=*` + `allow_credentials=True` is loose; tighten before prod.
- `/api/intake` overwrites without history; consider versioning subcollection.
- `course-data.ts` is still static — chapters/lessons should move to Firestore so admin can manage content.
- Affiliate URLs default to Amazon search; consider a real product catalog with deep links per retailer (Iherb / La Roche-Posay direct / SkinStore) once revenue justifies.

### Last Updated
2026-05-09 — iteration 2 complete (affiliate revenue + admin student detail page live).

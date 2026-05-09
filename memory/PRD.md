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
2. **Coach / Admin** (`role: "admin"`): the course owner. Sees all students, drills into individual profiles (intake answers, photos, check-ins), leaves notes, can promote/demote users.

### Core Requirements (static)
- Premium artistic direction must be preserved exactly as Lovable designed it (Fraunces+Inter, terracotta/cream palette, rounded-3xl cards, gradient warm hero blocks).
- Auth: Firebase email/password + Google sign-in.
- Personalized routine generated from intake quiz answers (rule-based for now; LLM-upgrade later).
- Progress photo journal with weekly comparison potential.
- Admin coach dashboard with student drill-down.

### What's Implemented (May 2026 — iteration 1)
- ✅ Full Firebase integration: client SDK + admin SDK, ID-token-protected endpoints.
- ✅ Email/password & Google sign-in on `/login` and `/register` (using existing Lovable visuals).
- ✅ Auto-bootstrap of Firestore `users/{uid}` doc on first auth.
- ✅ Protected routes (`/`, `/course`, `/products`, `/lesson/$id`, `/progress`, `/admin`).
- ✅ 6-step intake quiz at `/intake` → POST `/api/intake` → personalized AM/PM routine generated server-side and stored at `users/{uid}/intake/current` + on user doc.
- ✅ Progress photo journal at `/progress`: upload to Firebase Storage (`progress/{uid}/week-N/...`) + Firestore metadata via `/api/photos`.
- ✅ Sign-out, user menu with initials, week badge.
- ✅ Admin dashboard at `/admin` (admin-only) wired to live Firestore via `/api/admin/students`.
- ✅ 100% pass on testing agent: 12/12 backend tests + full frontend signup→bootstrap→intake→/products→signout E2E.

### Backend Endpoints
- `GET /api/health`
- `GET /api/auth/me` (auth)
- `POST /api/auth/bootstrap` (auth, idempotent)
- `POST /api/intake`, `GET /api/intake` (auth)
- `POST /api/checkins`, `GET /api/checkins` (auth)
- `POST /api/photos`, `GET /api/photos` (auth)
- `GET /api/admin/students` (admin)
- `GET /api/admin/students/{uid}` (admin)
- `POST /api/admin/notes` (admin)
- `POST /api/admin/promote` (admin)

### Prioritized Backlog (Lovable's recommendations)
**P0 — next iteration:**
- Individual student detail page (`/admin/students/$uid`) with tabs: intake, photos, check-ins, notes, message thread.
- Daily check-in widget on dashboard + skin-score graph (recharts).
- Routine builder UI (drag-and-drop AM/PM steps from a product catalog).

**P1:**
- 1:1 messaging student ↔ coach.
- Photo review queue (admin) + smart alerts (no check-in 5d, 3 bad days, etc.).
- Product catalog CRUD (admin).
- Email/push notifications (Firebase Cloud Messaging or SendGrid).

**P2:**
- Stripe subscriptions (pause/cancel/upgrade) — user said "later".
- Cohort/batch view + revenue analytics.
- Certificate at week 12.
- Coach note templates & audit log.

### Known Tech Debt
- `server.py` is a single 400-line file → should be split into routers (`auth/`, `intake/`, `photos/`, `admin/`).
- `CORS_ORIGINS=*` + `allow_credentials=True` is loose; tighten before prod.
- `/api/intake` overwrites without history; consider versioning subcollection.
- `course-data.ts` is still static — chapters/lessons should move to Firestore so admin can manage content.

### Last Updated
2026-05-09 — iteration 1 complete (Firebase Auth + DB + Storage + intake + photos + admin live).

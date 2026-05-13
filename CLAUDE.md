# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev
npm run dev          # Start Vite dev server (TanStack Start / SSR)
npm run build        # Production build (Node.js / Vercel output)
npm run build:vercel # Build + run scripts/prepare-vercel.mjs (for deployment)
npm run lint         # ESLint
npm run format       # Prettier

# Python backend (from /backend)
pip install -r requirements.txt
uvicorn server:app --reload   # FastAPI dev server
python scripts/set_admin.py   # Grant admin role to a Firebase UID
```

There are no automated tests in the frontend. The `backend/tests/` directory contains backend tests.

## Architecture

This is a **12-week acne protocol web app** ("Protocole Clear") with a French-language UI. It is a full-stack SSR app deployed to Vercel.

### Frontend — TanStack Start (SSR React)

- **Framework**: TanStack Start (TanStack Router + TanStack Query + Vite). SSR is handled by `src/start.ts` and `src/server.ts`.
- **Routing**: File-based via `src/routes/`. Routes prefixed `admin_` are admin-only (e.g. `admin_.routines.tsx`, `admin_.student.$uid.tsx`). The route tree is auto-generated into `src/routeTree.gen.ts` — do not edit it manually.
- **Auth**: Firebase Auth (email/password + Google). `src/hooks/use-auth.tsx` exports `useAuth()` and `<AuthProvider>`. Admin status is determined by checking `config/admins.uids[]` in Firestore (not a custom claim).
- **UI**: shadcn/ui components in `src/components/ui/`, Tailwind CSS v4, Radix UI primitives, Framer Motion for animations. Fonts are Fraunces (serif headings) + Inter (body).
- **State**: TanStack Query for server state; local React state for UI.

### Backend services

| Service | Purpose |
|---|---|
| Firebase Auth | User authentication |
| Firestore | All app data (users, routines, intake answers, progress, nutrition, etc.) |
| Firebase Storage | Progress photos |
| Cloudflare R2 | Product image uploads (via AWS S3-compatible presigned URLs; checksum middlewares removed — R2 rejects them) |
| Inngest | Durable background jobs: welcome sequence, intake confirmation, routine follow-up. Served at `/api/inngest` via `src/start.ts` middleware. |
| Resend | Transactional email (via `RESEND_API_KEY` env var) |

### Python FastAPI backend (`/backend/server.py`)

A separate FastAPI service (not deployed with the frontend). It authenticates requests using Firebase ID tokens (`Authorization: Bearer <token>`). Admin access is checked by reading `users/{uid}.is_admin` or `users/{uid}.role == "admin"` in Firestore. This is **separate** from the client-side admin check which reads `config/admins.uids[]`.

### Key Firestore collections

`users`, `intake_answers`, `routines`, `progress`, `daily_checkins`, `progress_photos`, `coach_notes`, `nutrition`, `nutrition_checkins`, `routine_checkins`, `routine_reports`, `onboarding_tokens`, `config/admins`

### Admin flow

Admins are identified by their UID being present in `config/admins.uids[]` in Firestore. Run `backend/scripts/set_admin.py` to grant admin access. Admin routes are guarded client-side in `use-auth.tsx` and server-side in the FastAPI backend.

Onboarding tokens (UUID v4) are created by admins and shared as invite links (`/start/:token`). Tokens are single-use and expire.

### Vite config note

`vite.config.ts` uses `@lovable.dev/vite-tanstack-config`. Do **not** manually add `tanstackStart`, `viteReact`, `tailwindcss`, `tsConfigPaths`, or `cloudflare` plugins — they are already included. The `cloudflare: false` flag targets Node.js (Vercel) instead of a Cloudflare Worker.

## Env vars

Required at runtime:
- `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY` — R2 uploads
- `RESEND_API_KEY`, `RESEND_FROM` — email
- `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` — Inngest
- `FIREBASE_SERVICE_ACCOUNT_PATH` — Python backend only

# Lumen — Test Credentials

## Firebase Project
- **Project ID**: methode-clear
- **Auth Domain**: methode-clear.firebaseapp.com
- **Console**: https://console.firebase.google.com/project/methode-clear/

## Auth Methods Enabled
- Email/Password
- Google Sign-In

## Admin gating
A user is admin when their Firestore doc `users/{uid}` has **`is_admin: true`**.
Backward compat: `role: "admin"` still works.

## Promote a user to admin (recommended)
```bash
python /app/backend/scripts/set_admin.py user@example.com           # promote
python /app/backend/scripts/set_admin.py user@example.com --revoke  # demote
```

Or directly in Firebase Console → Firestore → `users` → `<uid>` → set `is_admin: true`.

## Test Accounts
No accounts are pre-seeded. Workflow:
1. Sign up at `/register` (creates Firebase Auth user + `users/{uid}` doc with `is_admin: false`).
2. Promote with the script above.
3. Reload the page → admin nav link appears, /admin and /admin/students/* unlocked.

### Suggested test pair
- **Student**: `student-test@example.com` / `Lumen123!`
- **Admin**: `admin-test@example.com` / `Lumen123!` (then run promote script)

## Routine workflow (NEW)
1. Student fills intake at `/intake` → submitted; `/products` shows "Your routine is being prepared" banner.
2. Coach goes to `/admin/students/{uid}` → **Routine** tab.
3. Coach clicks "Generate draft from intake" (optional starting point) OR adds products manually.
4. Coach edits each product (category, name, brand, image URL, description, amount, frequency, instructions, affiliate URL).
5. Coach clicks **Save draft**.
6. Coach clicks **Publish to student** — student now sees the routine on `/products`.
7. Coach can **Unpublish** to revert to "preparing" state if needed.

## Backend Service Account
Located at `/app/backend/firebase-admin.json` (gitignored).

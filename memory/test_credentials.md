# Lumen — Test Credentials

## Firebase Project
- **Project ID**: methode-clear
- **Auth Domain**: methode-clear.firebaseapp.com
- **Console**: https://console.firebase.google.com/project/methode-clear/

## Auth Methods Enabled
- Email/Password
- Google Sign-In

## Test Accounts
No test accounts have been pre-seeded. To test:

### Create a student account
1. Go to `/register`
2. Enter any name + valid email + password (≥6 chars)
3. Account is created via Firebase Auth, then bootstrapped in Firestore (`users/{uid}`) with `role: "student"`

### Make a user an admin
After signing up, run this in a terminal to promote to admin (or do it manually in Firebase Console > Firestore > users > {uid} > set role="admin"):

```bash
cd /app/backend && python3 -c "
import firebase_admin
from firebase_admin import credentials, firestore
cred = credentials.Certificate('/app/backend/firebase-admin.json')
firebase_admin.initialize_app(cred)
db = firestore.client()
# Replace EMAIL with the user's email:
EMAIL = 'your@email.com'
for d in db.collection('users').where('email', '==', EMAIL).stream():
    db.collection('users').document(d.id).set({'role': 'admin'}, merge=True)
    print('Promoted', d.id)
"
```

### Recommended test accounts
- **Student**: create with email like `student-test@example.com` / password `Lumen123!`
- **Admin**: create with email `admin-test@example.com` / password `Lumen123!` then run the promote script above

## Backend Service Account
Located at `/app/backend/firebase-admin.json` (gitignored).
Used by FastAPI (`firebase-admin`) to verify ID tokens & operate on Firestore/Storage.

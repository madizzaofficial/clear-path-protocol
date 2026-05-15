#!/usr/bin/env python3
"""
Promote / demote a Firebase Auth user to admin in Firestore.

Usage:
    python /app/backend/scripts/set_admin.py user@example.com           # promote
    python /app/backend/scripts/set_admin.py user@example.com --revoke  # demote
"""
import sys
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore, auth as fb_auth

CRED_PATH = Path(__file__).resolve().parents[1] / "firebase-admin.json"


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] in {"-h", "--help"}:
        print(__doc__)
        return 1

    email = sys.argv[1].strip().lower()
    revoke = "--revoke" in sys.argv

    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.Certificate(str(CRED_PATH)))
    db = firestore.client()

    try:
        user = fb_auth.get_user_by_email(email)
    except Exception as e:  # noqa: BLE001
        print(f"❌ User not found in Firebase Auth: {email} ({e})")
        return 2

    db.collection("users").document(user.uid).set(
        {
            "is_admin": not revoke,
            "role": "student" if revoke else "admin",  # legacy mirror
        },
        merge=True,
    )
    # Keep config/admins.uids[] in sync so frontend check agrees with backend
    admins_ref = db.collection("config").document("admins")
    if revoke:
        admins_ref.update({"uids": firestore.ArrayRemove([user.uid])})
    else:
        admins_ref.set({"uids": firestore.ArrayUnion([user.uid])}, merge=True)
    action = "revoked admin from" if revoke else "promoted to admin"
    print(f"✅ {action} {email} (uid={user.uid})")
    return 0


if __name__ == "__main__":
    sys.exit(main())

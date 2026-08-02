#!/usr/bin/env python3
"""
One-shot backfill: set accountType='full' on every existing users/{uid} that
does not already have the field. New users created via /admin/student/new
will get accountType='routine_only' automatically; this script exists so
legacy users keep their full access (Suivi, Protocole, FAQ, INCI, etc.).

Usage:
    python /app/backend/scripts/backfill_account_type.py
    python /app/backend/scripts/backfill_account_type.py --dry-run
"""
import sys
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

CRED_PATH = Path(__file__).resolve().parents[1] / "firebase-admin.json"


def main() -> int:
    dry_run = "--dry-run" in sys.argv

    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.Certificate(str(CRED_PATH)))
    db = firestore.client()

    users_ref = db.collection("users")
    scanned = 0
    updated = 0
    skipped = 0

    for doc in users_ref.stream():
        scanned += 1
        data = doc.to_dict() or {}
        if "accountType" in data:
            skipped += 1
            continue
        if dry_run:
            print(f"  [dry-run] would set accountType='full' on {doc.id} ({data.get('email') or data.get('displayName') or '—'})")
        else:
            doc.reference.set({"accountType": "full"}, merge=True)
        updated += 1

    action = "would update" if dry_run else "updated"
    print(f"✅ {action} {updated} of {scanned} users. Skipped {skipped} (already had accountType).")
    return 0


if __name__ == "__main__":
    sys.exit(main())

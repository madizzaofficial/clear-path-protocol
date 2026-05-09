"""Cleanup iter3 scratch users + their docs."""
import json, firebase_admin
from firebase_admin import credentials, auth as fb_auth, firestore

if not firebase_admin._apps:
    firebase_admin.initialize_app(credentials.Certificate("/app/backend/firebase-admin.json"))
db = firestore.client()

with open("/app/test_reports/iter3_creds.json") as f:
    c = json.load(f)

for k in ("admin","student"):
    uid = c[k]["uid"]
    # Delete subcollections of user doc
    user_ref = db.collection("users").document(uid)
    for sub in ("intake","checkins","photos","notes"):
        for d in user_ref.collection(sub).stream():
            d.reference.delete()
    user_ref.delete()
    try:
        fb_auth.delete_user(uid)
    except Exception as e:
        print(f"auth delete {uid}: {e}")
    print(f"cleaned {k} {uid}")
print("DONE")

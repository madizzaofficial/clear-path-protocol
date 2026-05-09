"""Iter3 setup: create scratch admin + student users and mint custom tokens for UI testing."""
import json, os, sys, time, uuid
import firebase_admin
from firebase_admin import credentials, auth as fb_auth, firestore

CRED = "/app/backend/firebase-admin.json"
if not firebase_admin._apps:
    firebase_admin.initialize_app(credentials.Certificate(CRED))
db = firestore.client()

run_id = uuid.uuid4().hex[:6]
admin_email = f"tester-admin-{run_id}@lumen-test.com"
stu_email = f"tester-stu-{run_id}@lumen-test.com"

admin = fb_auth.create_user(email=admin_email, password="Lumen123!", display_name="Iter3 Admin")
stu = fb_auth.create_user(email=stu_email, password="Lumen123!", display_name="Iter3 Stu")

# Bootstrap docs
now = firestore.SERVER_TIMESTAMP
db.collection("users").document(admin.uid).set({
    "uid": admin.uid, "email": admin_email, "fullName": "Iter3 Admin",
    "role": "admin", "intakeCompleted": False, "week": 1, "createdAt": now,
}, merge=True)
db.collection("users").document(stu.uid).set({
    "uid": stu.uid, "email": stu_email, "fullName": "Iter3 Stu",
    "role": "student", "intakeCompleted": False, "week": 1, "createdAt": now,
}, merge=True)

admin_tok = fb_auth.create_custom_token(admin.uid).decode()
stu_tok = fb_auth.create_custom_token(stu.uid).decode()

out = {
    "admin": {"uid": admin.uid, "email": admin_email, "customToken": admin_tok},
    "student": {"uid": stu.uid, "email": stu_email, "customToken": stu_tok},
    "run_id": run_id,
}
with open("/app/test_reports/iter3_creds.json", "w") as f:
    json.dump(out, f)
print(json.dumps({"run_id": run_id, "admin_uid": admin.uid, "stu_uid": stu.uid}))

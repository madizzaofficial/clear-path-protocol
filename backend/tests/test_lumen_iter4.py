"""
Lumen iteration-4 tests:
- is_admin gating (new field) + backward compat with role='admin'
- /api/intake decoupled from auto-routine (returns {ok: true})
- /api/routine student endpoint
- /api/admin/students/{uid}/routine PUT, /publish, /unpublish, /draft
- /api/admin/promote {uid, is_admin}
- /api/admin/students/{uid} response now includes routine field
"""
import os
import time
import uuid
import pytest
import requests

import firebase_admin
from firebase_admin import credentials, auth as fb_auth, firestore


def _read_env_var(path: str, key: str) -> str:
    try:
        with open(path) as f:
            for line in f:
                if line.startswith(f"{key}="):
                    return line.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass
    return ""


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or _read_env_var("/app/frontend/.env", "REACT_APP_BACKEND_URL")).rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"

WEB_API_KEY = _read_env_var("/app/frontend/.env", "VITE_FIREBASE_API_KEY")
assert WEB_API_KEY, "VITE_FIREBASE_API_KEY not set"

if not firebase_admin._apps:
    firebase_admin.initialize_app(credentials.Certificate("/app/backend/firebase-admin.json"))
db = firestore.client()


def _exchange_custom_token(custom_token) -> str:
    if isinstance(custom_token, bytes):
        custom_token = custom_token.decode()
    r = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={WEB_API_KEY}",
        json={"token": custom_token, "returnSecureToken": True}, timeout=20,
    )
    r.raise_for_status()
    return r.json()["idToken"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _mk_user(email_prefix: str, doc_extra: dict):
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_{email_prefix}_{suffix}@lumen-test.com"
    user = fb_auth.create_user(email=email, password="Lumen!Test123", display_name=email_prefix)
    base = {"uid": user.uid, "email": email, "fullName": email_prefix,
            "intakeCompleted": False, "week": 1, "createdAt": "2026-01-01T00:00:00+00:00"}
    base.update(doc_extra)
    db.collection("users").document(user.uid).set(base, merge=True)
    tok = _exchange_custom_token(fb_auth.create_custom_token(user.uid))
    return {"uid": user.uid, "email": email, "id_token": tok}


def _cleanup(uid: str):
    try:
        fb_auth.delete_user(uid)
    except Exception:
        pass
    try:
        for sub in ("intake", "photos", "checkins", "notes", "routine"):
            for d in db.collection("users").document(uid).collection(sub).stream():
                d.reference.delete()
        db.collection("users").document(uid).delete()
    except Exception:
        pass


@pytest.fixture(scope="module")
def student():
    s = _mk_user("student", {"is_admin": False, "role": "student"})
    yield s
    _cleanup(s["uid"])


@pytest.fixture(scope="module")
def admin_new():
    """Admin via new is_admin=true field (no role)."""
    a = _mk_user("adminnew", {"is_admin": True})
    yield a
    _cleanup(a["uid"])


@pytest.fixture(scope="module")
def admin_legacy():
    """Admin via legacy role='admin' (no is_admin)."""
    a = _mk_user("adminleg", {"role": "admin"})
    yield a
    _cleanup(a["uid"])


@pytest.fixture(scope="module")
def plain_user():
    """User with neither is_admin nor role=admin."""
    u = _mk_user("plain", {"is_admin": False, "role": "student"})
    yield u
    _cleanup(u["uid"])


# ===== get_admin_user gating =====
class TestAdminGating:
    def test_is_admin_true_can_access(self, admin_new):
        r = requests.get(f"{BASE_URL}/api/admin/students", headers=_h(admin_new["id_token"]))
        assert r.status_code == 200, r.text

    def test_legacy_role_admin_still_works(self, admin_legacy):
        r = requests.get(f"{BASE_URL}/api/admin/students", headers=_h(admin_legacy["id_token"]))
        assert r.status_code == 200, r.text

    def test_plain_user_403(self, plain_user):
        r = requests.get(f"{BASE_URL}/api/admin/students", headers=_h(plain_user["id_token"]))
        assert r.status_code == 403

    def test_no_token_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/students")
        assert r.status_code == 401


# ===== Intake decoupling =====
class TestIntakeDecoupled:
    def test_intake_returns_ok_only(self, student):
        payload = {"skinType": "oily", "concerns": ["acne"], "severity": "moderate",
                   "pregnancy": False, "goals": ["clear"]}
        r = requests.post(f"{BASE_URL}/api/intake", json=payload, headers=_h(student["id_token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body == {"ok": True} or body.get("ok") is True
        # Critical: routine NOT auto-returned
        assert "routine" not in body

    def test_routine_is_pending_after_intake(self, student):
        r = requests.get(f"{BASE_URL}/api/routine", headers=_h(student["id_token"]))
        assert r.status_code == 200, r.text
        routine = r.json().get("routine")
        assert routine is not None
        assert routine.get("status") == "pending"
        # steps should be empty until coach builds
        assert routine["morning"]["steps"] == []
        assert routine["evening"]["steps"] == []


# ===== /api/routine student endpoint =====
class TestStudentRoutineEndpoint:
    def test_routine_null_when_no_intake(self):
        u = _mk_user("noroute", {"is_admin": False, "role": "student"})
        try:
            r = requests.get(f"{BASE_URL}/api/routine", headers=_h(u["id_token"]))
            assert r.status_code == 200
            assert r.json() == {"routine": None}
        finally:
            _cleanup(u["uid"])

    def test_routine_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/routine")
        assert r.status_code == 401


# ===== Admin routine builder =====
class TestAdminRoutineBuilder:
    def test_full_flow_draft_save_publish_unpublish(self, admin_new, student):
        uid = student["uid"]
        ah = _h(admin_new["id_token"])

        # 1) Generate draft from intake (intake was submitted in TestIntakeDecoupled)
        r = requests.post(f"{BASE_URL}/api/admin/students/{uid}/routine/draft", headers=ah)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        routine = body["routine"]
        assert routine["status"] == "pending"  # preserved
        assert len(routine["morning"]["steps"]) >= 1
        assert len(routine["evening"]["steps"]) >= 1

        # 2) Save edits via PUT
        save_payload = {
            "morning": {
                "title": "Morning Ritual",
                "subtitle": "After waking",
                "totalMinutes": 5,
                "steps": [
                    {"step": 1, "category": "Cleanser", "productName": "Custom Cleanser",
                     "brand": "TestBrand", "amount": "Pea-sized", "frequency": "Daily",
                     "howTo": "Massage", "description": "desc",
                     "affiliateUrl": "https://example.com/buy", "imageUrl": "https://x/img.png"},
                ],
            },
            "evening": {
                "title": "Evening Ritual", "subtitle": "Before bed",
                "totalMinutes": 6,
                "steps": [
                    {"step": 1, "category": "Treatment", "productName": "Adapalene",
                     "brand": "Differin", "amount": "Pea", "frequency": "Nightly",
                     "howTo": "Apply", "description": "", "affiliateUrl": "", "imageUrl": ""},
                ],
            },
            "rationale": ["Test rationale line"],
        }
        r = requests.put(f"{BASE_URL}/api/admin/students/{uid}/routine",
                         json=save_payload, headers=ah)
        assert r.status_code == 200, r.text
        saved = r.json()["routine"]
        assert saved["status"] == "pending"  # status preserved on save
        assert saved["morning"]["steps"][0]["productName"] == "Custom Cleanser"
        assert saved["rationale"] == ["Test rationale line"]

        # 3) Verify student GET /api/routine returns pending (NOT yet published)
        r = requests.get(f"{BASE_URL}/api/routine", headers=_h(student["id_token"]))
        assert r.status_code == 200
        assert r.json()["routine"]["status"] == "pending"

        # 4) Publish
        r = requests.post(f"{BASE_URL}/api/admin/students/{uid}/routine/publish", headers=ah)
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True

        # 5) Student now sees published
        r = requests.get(f"{BASE_URL}/api/routine", headers=_h(student["id_token"]))
        assert r.status_code == 200
        rt = r.json()["routine"]
        assert rt["status"] == "published"
        assert "publishedAt" in rt
        assert rt["morning"]["steps"][0]["productName"] == "Custom Cleanser"

        # 6) Re-saving draft preserves published status (per spec: status preserved)
        r = requests.put(f"{BASE_URL}/api/admin/students/{uid}/routine",
                         json=save_payload, headers=ah)
        assert r.status_code == 200
        assert r.json()["routine"]["status"] == "published"

        # 7) Unpublish
        r = requests.post(f"{BASE_URL}/api/admin/students/{uid}/routine/unpublish", headers=ah)
        assert r.status_code == 200
        r = requests.get(f"{BASE_URL}/api/routine", headers=_h(student["id_token"]))
        assert r.json()["routine"]["status"] == "pending"

        # 8) admin_student_detail now includes routine
        r = requests.get(f"{BASE_URL}/api/admin/students/{uid}", headers=ah)
        assert r.status_code == 200
        body = r.json()
        assert "routine" in body
        assert body["routine"]["morning"]["steps"][0]["productName"] == "Custom Cleanser"

    def test_draft_400_when_no_intake(self, admin_new):
        u = _mk_user("nointake", {"is_admin": False, "role": "student"})
        try:
            r = requests.post(f"{BASE_URL}/api/admin/students/{u['uid']}/routine/draft",
                              headers=_h(admin_new["id_token"]))
            assert r.status_code == 400
        finally:
            _cleanup(u["uid"])

    def test_publish_400_when_no_routine(self, admin_new):
        u = _mk_user("noroutine", {"is_admin": False, "role": "student"})
        try:
            # Ensure no routine doc
            r = requests.post(f"{BASE_URL}/api/admin/students/{u['uid']}/routine/publish",
                              headers=_h(admin_new["id_token"]))
            assert r.status_code == 400
        finally:
            _cleanup(u["uid"])

    def test_non_admin_cannot_save_routine(self, student):
        r = requests.put(f"{BASE_URL}/api/admin/students/{student['uid']}/routine",
                         json={"morning": {"steps": []}, "evening": {"steps": []}, "rationale": []},
                         headers=_h(student["id_token"]))
        assert r.status_code == 403

    def test_non_admin_cannot_publish(self, student):
        r = requests.post(f"{BASE_URL}/api/admin/students/{student['uid']}/routine/publish",
                          headers=_h(student["id_token"]))
        assert r.status_code == 403


# ===== /api/admin/promote (new shape) =====
class TestAdminPromote:
    def test_promote_with_is_admin_true(self, admin_new):
        u = _mk_user("topromote", {"is_admin": False, "role": "student"})
        try:
            r = requests.post(f"{BASE_URL}/api/admin/promote",
                              json={"uid": u["uid"], "is_admin": True},
                              headers=_h(admin_new["id_token"]))
            assert r.status_code == 200, r.text
            # Verify Firestore doc updated
            doc = db.collection("users").document(u["uid"]).get().to_dict()
            assert doc.get("is_admin") is True

            # Promoted user can call admin endpoint
            new_tok = _exchange_custom_token(fb_auth.create_custom_token(u["uid"]))
            r2 = requests.get(f"{BASE_URL}/api/admin/students", headers=_h(new_tok))
            assert r2.status_code == 200
        finally:
            _cleanup(u["uid"])

    def test_promote_with_is_admin_false_revokes(self, admin_new):
        u = _mk_user("torevoke", {"is_admin": True})
        try:
            r = requests.post(f"{BASE_URL}/api/admin/promote",
                              json={"uid": u["uid"], "is_admin": False},
                              headers=_h(admin_new["id_token"]))
            assert r.status_code == 200
            doc = db.collection("users").document(u["uid"]).get().to_dict()
            assert doc.get("is_admin") is False
        finally:
            _cleanup(u["uid"])

    def test_promote_old_role_payload_rejected(self, admin_new):
        u = _mk_user("oldsig", {"is_admin": False})
        try:
            r = requests.post(f"{BASE_URL}/api/admin/promote",
                              json={"uid": u["uid"], "role": "admin"},
                              headers=_h(admin_new["id_token"]))
            # Should be 422 (pydantic validation: missing is_admin)
            assert r.status_code == 422
        finally:
            _cleanup(u["uid"])

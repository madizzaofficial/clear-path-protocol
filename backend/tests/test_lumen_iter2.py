"""
Lumen iteration-2 authenticated integration tests.

Covers:
- GET /api/intake: each routine step has an affiliateUrl containing brand+productName as Amazon search query
- GET /api/admin/students/{uid}: returns {profile, intake, photos, checkins, notes}; 403 for non-admin
- POST /api/admin/notes: admin creates note; 403 for non-admin
- 401 already covered by test_lumen_api.py

Auth strategy: firebase-admin creates two users, mints custom tokens,
then exchanges them for ID tokens via Firebase Auth REST API
(signInWithCustomToken). The web API key is read from /app/frontend/.env
(VITE_FIREBASE_API_KEY).
"""
import os
import re
import time
import uuid
import pytest
import requests
from urllib.parse import urlparse, parse_qs, unquote_plus

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

# Read Firebase web API key from frontend .env
def _read_web_api_key() -> str:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("VITE_FIREBASE_API_KEY="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("VITE_FIREBASE_API_KEY not found")

WEB_API_KEY = _read_web_api_key()

# Init firebase-admin (idempotent across pytest runs)
if not firebase_admin._apps:
    cred = credentials.Certificate("/app/backend/firebase-admin.json")
    firebase_admin.initialize_app(cred)
db = firestore.client()


def _exchange_custom_token(custom_token: str) -> str:
    """Exchange a Firebase custom token for an ID token via REST API."""
    if isinstance(custom_token, bytes):
        custom_token = custom_token.decode()
    r = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={WEB_API_KEY}",
        json={"token": custom_token, "returnSecureToken": True},
        timeout=20,
    )
    r.raise_for_status()
    return r.json()["idToken"]


@pytest.fixture(scope="module")
def student():
    uid_suffix = uuid.uuid4().hex[:8]
    email = f"TEST_student_{uid_suffix}@lumen-test.com"
    user = fb_auth.create_user(email=email, password="Lumen!Test123", display_name=f"Test Student {uid_suffix}")
    # Bootstrap user doc with role=student
    db.collection("users").document(user.uid).set({
        "uid": user.uid,
        "email": email,
        "fullName": f"Test Student {uid_suffix}",
        "role": "student",
        "intakeCompleted": False,
        "week": 1,
        "createdAt": "2026-01-01T00:00:00+00:00",
    }, merge=True)
    custom_tok = fb_auth.create_custom_token(user.uid)
    id_token = _exchange_custom_token(custom_tok)
    yield {"uid": user.uid, "email": email, "id_token": id_token}
    # Teardown
    try:
        fb_auth.delete_user(user.uid)
    except Exception:
        pass
    try:
        # Clean subcollections + doc
        for sub in ("intake", "photos", "checkins", "notes"):
            for d in db.collection("users").document(user.uid).collection(sub).stream():
                d.reference.delete()
        db.collection("users").document(user.uid).delete()
    except Exception:
        pass


@pytest.fixture(scope="module")
def admin_user():
    uid_suffix = uuid.uuid4().hex[:8]
    email = f"TEST_admin_{uid_suffix}@lumen-test.com"
    user = fb_auth.create_user(email=email, password="Lumen!Test123", display_name=f"Test Admin {uid_suffix}")
    db.collection("users").document(user.uid).set({
        "uid": user.uid,
        "email": email,
        "fullName": f"Test Admin {uid_suffix}",
        "role": "admin",
        "createdAt": "2026-01-01T00:00:00+00:00",
    }, merge=True)
    custom_tok = fb_auth.create_custom_token(user.uid)
    id_token = _exchange_custom_token(custom_tok)
    yield {"uid": user.uid, "email": email, "id_token": id_token}
    try:
        fb_auth.delete_user(user.uid)
    except Exception:
        pass
    try:
        db.collection("users").document(user.uid).delete()
    except Exception:
        pass


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ============================================================
# Affiliate URLs in routine
# ============================================================
class TestAffiliateUrls:
    def test_intake_post_then_get_returns_affiliate_urls(self, student):
        # Submit intake → triggers routine generation
        payload = {
            "skinType": "oily",
            "concerns": ["acne", "redness"],
            "severity": "moderate",
            "triggers": ["dairy"],
            "pregnancy": False,
            "goals": ["clear skin"],
        }
        r = requests.post(f"{BASE_URL}/api/intake", json=payload, headers=_h(student["id_token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert "routine" in body

        # Now GET intake and validate every step has an Amazon affiliate URL
        r2 = requests.get(f"{BASE_URL}/api/intake", headers=_h(student["id_token"]))
        assert r2.status_code == 200
        intake = r2.json()["intake"]
        assert intake is not None
        routine = intake["routine"]
        assert "morning" in routine and "evening" in routine

        for block_key in ("morning", "evening"):
            block = routine[block_key]
            assert isinstance(block.get("steps"), list) and len(block["steps"]) >= 1
            for step in block["steps"]:
                url = step.get("affiliateUrl")
                assert url, f"Missing affiliateUrl in {block_key} step {step.get('step')}: {step}"
                parsed = urlparse(url)
                assert "amazon." in parsed.netloc, f"affiliateUrl is not amazon: {url}"
                # Search query "k" should contain brand + productName
                qs = parse_qs(parsed.query)
                assert "k" in qs, f"Amazon URL missing 'k' search param: {url}"
                k = unquote_plus(qs["k"][0]).lower()
                # Brand check (first word, case-insensitive partial match)
                brand_first = step["brand"].split()[0].lower()
                assert brand_first in k, f"Brand '{brand_first}' not in search query '{k}'"

    def test_pregnancy_routine_uses_azelaic_with_affiliate(self, admin_user):
        # Use the admin user to test as a different student record
        # Actually just create a pregnancy intake on a fresh student
        uid_suffix = uuid.uuid4().hex[:8]
        email = f"TEST_preg_{uid_suffix}@lumen-test.com"
        u = fb_auth.create_user(email=email, password="Lumen!Test123")
        db.collection("users").document(u.uid).set({"uid": u.uid, "email": email, "role": "student"}, merge=True)
        tok = _exchange_custom_token(fb_auth.create_custom_token(u.uid))
        try:
            r = requests.post(f"{BASE_URL}/api/intake", json={
                "skinType": "sensitive", "concerns": ["acne"], "severity": "mild",
                "pregnancy": True,
            }, headers=_h(tok))
            assert r.status_code == 200
            routine = r.json()["routine"]
            pm_step2 = routine["evening"]["steps"][1]
            assert "azelaic" in pm_step2["productName"].lower()
            assert "amazon." in pm_step2["affiliateUrl"]
        finally:
            try:
                fb_auth.delete_user(u.uid)
                for sub in ("intake",):
                    for d in db.collection("users").document(u.uid).collection(sub).stream():
                        d.reference.delete()
                db.collection("users").document(u.uid).delete()
            except Exception:
                pass


# ============================================================
# Admin student detail + notes
# ============================================================
class TestAdminStudentDetail:
    def test_student_cannot_access_admin_detail(self, student):
        r = requests.get(f"{BASE_URL}/api/admin/students/{student['uid']}", headers=_h(student["id_token"]))
        assert r.status_code == 403

    def test_admin_can_get_student_detail(self, admin_user, student):
        r = requests.get(f"{BASE_URL}/api/admin/students/{student['uid']}", headers=_h(admin_user["id_token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        # Validate response shape
        for key in ("profile", "intake", "photos", "checkins", "notes"):
            assert key in body, f"Missing key: {key}"
        assert isinstance(body["photos"], list)
        assert isinstance(body["checkins"], list)
        assert isinstance(body["notes"], list)
        # Profile should have email + uid (we set uid in firestore explicitly)
        assert body["profile"].get("email") == student["email"]

    def test_admin_get_unknown_student_404(self, admin_user):
        r = requests.get(f"{BASE_URL}/api/admin/students/no-such-uid-xyz", headers=_h(admin_user["id_token"]))
        assert r.status_code == 404


class TestAdminNotes:
    def test_student_cannot_post_note(self, student):
        r = requests.post(f"{BASE_URL}/api/admin/notes",
                          json={"studentUid": student["uid"], "note": "should fail"},
                          headers=_h(student["id_token"]))
        assert r.status_code == 403

    def test_admin_can_post_note_and_it_persists(self, admin_user, student):
        note_text = f"E2E note {uuid.uuid4().hex[:6]}"
        r = requests.post(f"{BASE_URL}/api/admin/notes",
                          json={"studentUid": student["uid"], "note": note_text},
                          headers=_h(admin_user["id_token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        note = body["note"]
        assert note["note"] == note_text
        assert note["studentUid"] == student["uid"]
        assert note["authorUid"] == admin_user["uid"]
        assert "id" in note and "createdAt" in note

        # Verify persistence via admin detail endpoint
        time.sleep(0.5)
        r2 = requests.get(f"{BASE_URL}/api/admin/students/{student['uid']}", headers=_h(admin_user["id_token"]))
        assert r2.status_code == 200
        notes = r2.json()["notes"]
        assert any(n["note"] == note_text and n["id"] == note["id"] for n in notes), \
            f"Created note not found in detail response. Got {len(notes)} notes."

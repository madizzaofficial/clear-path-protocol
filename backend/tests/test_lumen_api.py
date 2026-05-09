"""
Lumen API backend tests
- Health check
- Auth-protected endpoints reject without bearer token (401)
- Admin endpoints reject without bearer token
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fceb180a-ce4a-42ed-be80-d82f0675e4fd.preview.emergentagent.com").rstrip("/")


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Health ---
class TestHealth:
    def test_health_ok(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"
        assert "ts" in data


# --- Auth gates ---
class TestAuthGates:
    def test_me_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_bootstrap_requires_auth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/bootstrap", json={})
        assert r.status_code == 401

    def test_intake_post_requires_auth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/intake", json={
            "skinType": "oily", "concerns": ["acne"], "severity": "mild"
        })
        assert r.status_code == 401

    def test_intake_get_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/intake")
        assert r.status_code == 401

    def test_checkins_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/checkins")
        assert r.status_code == 401

    def test_photos_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/photos")
        assert r.status_code == 401

    def test_admin_students_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/admin/students")
        assert r.status_code == 401

    def test_admin_student_detail_requires_auth(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/admin/students/fakeuid")
        assert r.status_code == 401

    def test_admin_notes_requires_auth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/admin/notes", json={"studentUid": "x", "note": "y"})
        assert r.status_code == 401

    def test_admin_promote_requires_auth(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/admin/promote", json={"uid": "x", "role": "admin"})
        assert r.status_code == 401


# --- Invalid tokens are rejected ---
class TestInvalidToken:
    def test_invalid_bearer_token_rejected(self, api_client):
        api_client.headers.update({"Authorization": "Bearer invalid.token.here"})
        r = api_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

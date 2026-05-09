"""
Lumen — Clear Skin Protocol API
FastAPI backend with Firebase Admin SDK (Auth + Firestore + Storage).
"""
import os
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Depends, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, EmailStr
from dotenv import load_dotenv

import firebase_admin
from firebase_admin import credentials, firestore, auth as fb_auth, storage as fb_storage

# ------------------------------------------------------------------
# Init
# ------------------------------------------------------------------
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
log = logging.getLogger("lumen")

SERVICE_ACCOUNT_PATH = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", "/app/backend/firebase-admin.json")
STORAGE_BUCKET = os.environ.get("FIREBASE_STORAGE_BUCKET", "methode-clear.firebasestorage.app")

if not firebase_admin._apps:
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred, {"storageBucket": STORAGE_BUCKET})

db = firestore.client()
bucket = fb_storage.bucket()

# ------------------------------------------------------------------
# App
# ------------------------------------------------------------------
app = FastAPI(title="Lumen API", version="0.1.0")

origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer_scheme = HTTPBearer(auto_error=False)


# ------------------------------------------------------------------
# Auth dependency
# ------------------------------------------------------------------
def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> Dict[str, Any]:
    if creds is None or not creds.credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    try:
        decoded = fb_auth.verify_id_token(creds.credentials)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {e}") from e
    return decoded


def get_admin_user(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Require user document with role == 'admin'."""
    uid = user["uid"]
    snap = db.collection("users").document(uid).get()
    role = (snap.to_dict() or {}).get("role") if snap.exists else None
    if role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin only")
    return user


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ------------------------------------------------------------------
# Models
# ------------------------------------------------------------------
class ProfileUpsert(BaseModel):
    fullName: Optional[str] = None
    email: Optional[EmailStr] = None
    photoURL: Optional[str] = None


class IntakeAnswers(BaseModel):
    skinType: str = Field(..., description="dry|oily|combo|normal|sensitive")
    concerns: List[str]
    severity: str  # mild|moderate|severe
    triggers: List[str] = []
    currentRoutine: Optional[str] = None
    pregnancy: bool = False
    medications: Optional[str] = None
    sleepHours: Optional[int] = None
    stressLevel: Optional[int] = None  # 1-5
    dietNotes: Optional[str] = None
    goals: List[str] = []


class DailyCheckin(BaseModel):
    date: str  # YYYY-MM-DD
    amDone: bool = False
    pmDone: bool = False
    mood: Optional[int] = None  # 1-5
    breakoutLevel: Optional[int] = None  # 1-5
    notes: Optional[str] = None


class ProgressPhotoMeta(BaseModel):
    week: int
    angle: str  # front|left|right
    storagePath: str
    downloadURL: str


class CoachNote(BaseModel):
    studentUid: str
    note: str


# ------------------------------------------------------------------
# Routine generation (rule-based for now)
# ------------------------------------------------------------------
def generate_routine(answers: IntakeAnswers) -> Dict[str, Any]:
    """Build a starter AM/PM routine from intake answers."""
    am, pm = [], []

    # Cleanser — gentler if sensitive/dry
    if answers.skinType in {"sensitive", "dry"}:
        am.append({"step": 1, "category": "Cleanser", "productName": "Hydrating Gentle Cleanser",
                   "brand": "CeraVe", "amount": "Pea-sized", "frequency": "Every morning",
                   "howTo": "Massage onto damp skin for 30s, rinse with lukewarm water."})
    else:
        am.append({"step": 1, "category": "Cleanser", "productName": "Gentle Gel Cleanser",
                   "brand": "La Roche-Posay", "amount": "Pea-sized", "frequency": "Every morning",
                   "howTo": "Massage onto damp skin for 30s, rinse."})

    # Treatment serum
    am.append({"step": 2, "category": "Serum", "productName": "Niacinamide 10%",
               "brand": "The Ordinary", "amount": "3-4 drops", "frequency": "Every morning",
               "howTo": "Apply to clean dry skin, wait 60s."})

    am.append({"step": 3, "category": "Moisturizer", "productName": "Ceramide Moisturizer",
               "brand": "CeraVe", "amount": "Pea-sized", "frequency": "Every morning",
               "howTo": "Press gently into skin until absorbed."})

    am.append({"step": 4, "category": "Sunscreen", "productName": "Mineral SPF 50",
               "brand": "EltaMD UV Clear", "amount": "Two-finger length", "frequency": "Every morning",
               "howTo": "Final step. Reapply every 2h outdoors."})

    # PM
    pm.append({"step": 1, "category": "Cleanser", "productName": am[0]["productName"],
               "brand": am[0]["brand"], "amount": "Pea-sized", "frequency": "Every evening",
               "howTo": "Double cleanse if you wore SPF or makeup."})

    # Active treatment depends on severity & pregnancy
    if answers.pregnancy:
        pm.append({"step": 2, "category": "Treatment", "productName": "Azelaic Acid 10%",
                   "brand": "The Ordinary", "amount": "Pea-sized", "frequency": "Every evening",
                   "howTo": "Pregnancy-safe alternative to retinoids."})
    elif answers.severity == "severe":
        pm.append({"step": 2, "category": "Treatment", "productName": "Adapalene 0.1%",
                   "brand": "Differin", "amount": "Pea-sized", "frequency": "Every evening",
                   "howTo": "Apply to fully dry skin. Mild tingling is normal."})
    else:
        pm.append({"step": 2, "category": "Treatment", "productName": "Adapalene 0.1%",
                   "brand": "Differin", "amount": "Pea-sized", "frequency": "3-4× per week",
                   "howTo": "Build tolerance: every 3rd night for 2 weeks, then nightly."})

    pm.append({"step": 3, "category": "Moisturizer", "productName": "Ceramide Moisturizer",
               "brand": "CeraVe", "amount": "Generous layer", "frequency": "Every evening",
               "howTo": "Layer to seal in actives and support overnight repair."})

    return {
        "morning": {"id": "morning", "title": "Morning Ritual", "subtitle": "After waking, before breakfast",
                    "totalMinutes": 4, "steps": am},
        "evening": {"id": "evening", "title": "Evening Ritual", "subtitle": "30 minutes before bed",
                    "totalMinutes": 6, "steps": pm},
        "rationale": _build_rationale(answers),
    }


def _build_rationale(a: IntakeAnswers) -> List[str]:
    out = []
    if a.skinType in {"sensitive", "dry"}:
        out.append("We chose a hydrating cleanser to protect your barrier.")
    if a.severity == "severe":
        out.append("Adapalene every night to address active breakouts faster.")
    elif a.pregnancy:
        out.append("Azelaic acid is a pregnancy-safe alternative to retinoids.")
    else:
        out.append("Adapalene 3–4×/week to build tolerance gently.")
    out.append("Niacinamide 10% AM to calm redness and regulate sebum.")
    out.append("Mineral SPF 50 daily — non-negotiable for any acne protocol.")
    return out


# ------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------
@app.get("/api/health")
def health():
    return {"status": "ok", "ts": utcnow_iso()}


@app.get("/api/auth/me")
def me(user: Dict[str, Any] = Depends(get_current_user)):
    uid = user["uid"]
    snap = db.collection("users").document(uid).get()
    profile = snap.to_dict() if snap.exists else None
    return {
        "uid": uid,
        "email": user.get("email"),
        "emailVerified": user.get("email_verified", False),
        "name": user.get("name"),
        "picture": user.get("picture"),
        "profile": profile,
    }


@app.post("/api/auth/bootstrap")
def bootstrap(payload: ProfileUpsert, user: Dict[str, Any] = Depends(get_current_user)):
    """Called right after signup to create the user doc in Firestore."""
    uid = user["uid"]
    user_ref = db.collection("users").document(uid)
    snap = user_ref.get()
    if snap.exists:
        return {"ok": True, "created": False, "profile": snap.to_dict()}

    data = {
        "uid": uid,
        "email": payload.email or user.get("email"),
        "fullName": payload.fullName or user.get("name"),
        "photoURL": payload.photoURL or user.get("picture"),
        "role": "student",
        "intakeCompleted": False,
        "startDate": utcnow_iso(),
        "week": 1,
        "createdAt": utcnow_iso(),
        "updatedAt": utcnow_iso(),
    }
    user_ref.set(data, merge=True)
    return {"ok": True, "created": True, "profile": data}


# -------- Intake --------
@app.post("/api/intake")
def submit_intake(answers: IntakeAnswers, user: Dict[str, Any] = Depends(get_current_user)):
    uid = user["uid"]
    routine = generate_routine(answers)
    intake_doc = {
        "answers": answers.model_dump(),
        "routine": routine,
        "submittedAt": utcnow_iso(),
    }
    db.collection("users").document(uid).collection("intake").document("current").set(intake_doc)
    db.collection("users").document(uid).set({
        "intakeCompleted": True,
        "currentRoutine": routine,
        "skinType": answers.skinType,
        "severity": answers.severity,
        "updatedAt": utcnow_iso(),
    }, merge=True)
    return {"ok": True, "routine": routine}


@app.get("/api/intake")
def get_intake(user: Dict[str, Any] = Depends(get_current_user)):
    uid = user["uid"]
    snap = db.collection("users").document(uid).collection("intake").document("current").get()
    if not snap.exists:
        return {"intake": None}
    return {"intake": snap.to_dict()}


# -------- Daily Check-ins --------
@app.post("/api/checkins")
def upsert_checkin(payload: DailyCheckin, user: Dict[str, Any] = Depends(get_current_user)):
    uid = user["uid"]
    data = payload.model_dump()
    data["updatedAt"] = utcnow_iso()
    db.collection("users").document(uid).collection("checkins").document(payload.date).set(data, merge=True)
    return {"ok": True}


@app.get("/api/checkins")
def list_checkins(limit: int = Query(30, ge=1, le=120), user: Dict[str, Any] = Depends(get_current_user)):
    uid = user["uid"]
    q = (db.collection("users").document(uid).collection("checkins")
         .order_by("date", direction=firestore.Query.DESCENDING).limit(limit))
    items = []
    for d in q.stream():
        item = d.to_dict()
        item["id"] = d.id
        items.append(item)
    return {"items": items}


# -------- Progress Photos --------
@app.post("/api/photos")
def add_photo(payload: ProgressPhotoMeta, user: Dict[str, Any] = Depends(get_current_user)):
    uid = user["uid"]
    data = payload.model_dump()
    data["uid"] = uid
    data["createdAt"] = utcnow_iso()
    ref = db.collection("users").document(uid).collection("photos").document()
    ref.set(data)
    data["id"] = ref.id
    return {"ok": True, "photo": data}


@app.get("/api/photos")
def list_photos(user: Dict[str, Any] = Depends(get_current_user)):
    uid = user["uid"]
    q = db.collection("users").document(uid).collection("photos").order_by("createdAt", direction=firestore.Query.DESCENDING)
    items = []
    for d in q.stream():
        item = d.to_dict()
        item["id"] = d.id
        items.append(item)
    return {"items": items}


# -------- Admin --------
@app.get("/api/admin/students")
def admin_list_students(user: Dict[str, Any] = Depends(get_admin_user)):
    q = db.collection("users").where("role", "==", "student")
    out = []
    for d in q.stream():
        item = d.to_dict() or {}
        item["uid"] = d.id
        out.append({k: v for k, v in item.items() if k != "currentRoutine"})
    return {"items": out}


@app.get("/api/admin/students/{uid}")
def admin_student_detail(uid: str, user: Dict[str, Any] = Depends(get_admin_user)):
    snap = db.collection("users").document(uid).get()
    if not snap.exists:
        raise HTTPException(404, "Student not found")
    profile = snap.to_dict() or {}

    intake_snap = db.collection("users").document(uid).collection("intake").document("current").get()
    intake = intake_snap.to_dict() if intake_snap.exists else None

    photos = []
    for d in db.collection("users").document(uid).collection("photos").order_by("createdAt").stream():
        x = d.to_dict(); x["id"] = d.id; photos.append(x)

    checkins = []
    for d in (db.collection("users").document(uid).collection("checkins")
              .order_by("date", direction=firestore.Query.DESCENDING).limit(60).stream()):
        x = d.to_dict(); x["id"] = d.id; checkins.append(x)

    notes = []
    for d in (db.collection("users").document(uid).collection("notes")
              .order_by("createdAt", direction=firestore.Query.DESCENDING).stream()):
        x = d.to_dict(); x["id"] = d.id; notes.append(x)

    return {"profile": profile, "intake": intake, "photos": photos, "checkins": checkins, "notes": notes}


@app.post("/api/admin/notes")
def admin_add_note(payload: CoachNote, user: Dict[str, Any] = Depends(get_admin_user)):
    note = {
        "studentUid": payload.studentUid,
        "note": payload.note,
        "authorUid": user["uid"],
        "authorName": user.get("name") or user.get("email"),
        "createdAt": utcnow_iso(),
    }
    ref = db.collection("users").document(payload.studentUid).collection("notes").document()
    ref.set(note)
    note["id"] = ref.id
    return {"ok": True, "note": note}


# -------- Misc admin: promote --------
class PromoteBody(BaseModel):
    uid: str
    role: str  # student|admin


@app.post("/api/admin/promote")
def admin_promote(body: PromoteBody, user: Dict[str, Any] = Depends(get_admin_user)):
    if body.role not in {"student", "admin"}:
        raise HTTPException(400, "Invalid role")
    db.collection("users").document(body.uid).set({"role": body.role, "updatedAt": utcnow_iso()}, merge=True)
    return {"ok": True}

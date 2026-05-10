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
    """Require user document with `is_admin: true` (or legacy role == 'admin')."""
    uid = user["uid"]
    snap = db.collection("users").document(uid).get()
    data = (snap.to_dict() or {}) if snap.exists else {}
    is_admin = bool(data.get("is_admin")) or data.get("role") == "admin"
    if not is_admin:
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
    date: str  # YYYY-MM-DD
    angle: str  # front|left|right
    storagePath: str
    downloadURL: str
    notes: Optional[str] = ""


class CoachNote(BaseModel):
    studentUid: str
    note: str


# ------------------------------------------------------------------
# Routine generation (rule-based for now)
# ------------------------------------------------------------------
def generate_routine(answers: IntakeAnswers) -> Dict[str, Any]:
    """Build a starter AM/PM routine from intake answers."""
    am, pm = [], []

    def aff(name: str, brand: str) -> str:
        # Placeholder Amazon search; main agent should replace tag at runtime via env if needed.
        from urllib.parse import quote_plus
        q = quote_plus(f"{brand} {name}")
        return f"https://www.amazon.com/s?k={q}"

    # Cleanser — gentler if sensitive/dry
    if answers.skinType in {"sensitive", "dry"}:
        am.append({"step": 1, "category": "Cleanser", "productName": "Hydrating Gentle Cleanser",
                   "brand": "CeraVe", "amount": "Pea-sized", "frequency": "Every morning",
                   "howTo": "Massage onto damp skin for 30s, rinse with lukewarm water.",
                   "affiliateUrl": aff("Hydrating Cleanser", "CeraVe")})
    else:
        am.append({"step": 1, "category": "Cleanser", "productName": "Gentle Gel Cleanser",
                   "brand": "La Roche-Posay", "amount": "Pea-sized", "frequency": "Every morning",
                   "howTo": "Massage onto damp skin for 30s, rinse.",
                   "affiliateUrl": aff("Effaclar Gel Cleanser", "La Roche-Posay")})

    # Treatment serum
    am.append({"step": 2, "category": "Serum", "productName": "Niacinamide 10%",
               "brand": "The Ordinary", "amount": "3-4 drops", "frequency": "Every morning",
               "howTo": "Apply to clean dry skin, wait 60s.",
               "affiliateUrl": aff("Niacinamide 10% Zinc 1%", "The Ordinary")})

    am.append({"step": 3, "category": "Moisturizer", "productName": "Ceramide Moisturizer",
               "brand": "CeraVe", "amount": "Pea-sized", "frequency": "Every morning",
               "howTo": "Press gently into skin until absorbed.",
               "affiliateUrl": aff("Moisturizing Cream", "CeraVe")})

    am.append({"step": 4, "category": "Sunscreen", "productName": "Mineral SPF 50",
               "brand": "EltaMD UV Clear", "amount": "Two-finger length", "frequency": "Every morning",
               "howTo": "Final step. Reapply every 2h outdoors.",
               "affiliateUrl": aff("UV Clear SPF 46", "EltaMD")})

    # PM
    pm.append({"step": 1, "category": "Cleanser", "productName": am[0]["productName"],
               "brand": am[0]["brand"], "amount": "Pea-sized", "frequency": "Every evening",
               "howTo": "Double cleanse if you wore SPF or makeup.",
               "affiliateUrl": am[0]["affiliateUrl"]})

    # Active treatment depends on severity & pregnancy
    if answers.pregnancy:
        pm.append({"step": 2, "category": "Treatment", "productName": "Azelaic Acid 10%",
                   "brand": "The Ordinary", "amount": "Pea-sized", "frequency": "Every evening",
                   "howTo": "Pregnancy-safe alternative to retinoids.",
                   "affiliateUrl": aff("Azelaic Acid Suspension 10%", "The Ordinary")})
    elif answers.severity == "severe":
        pm.append({"step": 2, "category": "Treatment", "productName": "Adapalene 0.1%",
                   "brand": "Differin", "amount": "Pea-sized", "frequency": "Every evening",
                   "howTo": "Apply to fully dry skin. Mild tingling is normal.",
                   "affiliateUrl": aff("Adapalene Gel 0.1%", "Differin")})
    else:
        pm.append({"step": 2, "category": "Treatment", "productName": "Adapalene 0.1%",
                   "brand": "Differin", "amount": "Pea-sized", "frequency": "3-4× per week",
                   "howTo": "Build tolerance: every 3rd night for 2 weeks, then nightly.",
                   "affiliateUrl": aff("Adapalene Gel 0.1%", "Differin")})

    pm.append({"step": 3, "category": "Moisturizer", "productName": "Ceramide Moisturizer",
               "brand": "CeraVe", "amount": "Generous layer", "frequency": "Every evening",
               "howTo": "Layer to seal in actives and support overnight repair.",
               "affiliateUrl": aff("Moisturizing Cream", "CeraVe")})

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
        "is_admin": False,
        "role": "student",  # legacy; kept for backward compat
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
    """Store intake answers. Routine is NOT auto-published — coach reviews and publishes."""
    uid = user["uid"]
    intake_doc = {
        "answers": answers.model_dump(),
        "submittedAt": utcnow_iso(),
    }
    db.collection("users").document(uid).collection("intake").document("current").set(intake_doc)

    # Initialize routine in pending state if not already published.
    routine_ref = db.collection("users").document(uid).collection("routine").document("current")
    routine_snap = routine_ref.get()
    if not routine_snap.exists or (routine_snap.to_dict() or {}).get("status") != "published":
        routine_ref.set({
            "status": "pending",
            "morning": {"id": "morning", "title": "Morning Ritual", "subtitle": "After waking, before breakfast", "totalMinutes": 4, "steps": []},
            "evening": {"id": "evening", "title": "Evening Ritual", "subtitle": "30 minutes before bed", "totalMinutes": 6, "steps": []},
            "rationale": [],
            "updatedAt": utcnow_iso(),
        }, merge=True)

    db.collection("users").document(uid).set({
        "intakeCompleted": True,
        "skinType": answers.skinType,
        "severity": answers.severity,
        "updatedAt": utcnow_iso(),
    }, merge=True)
    return {"ok": True}


@app.get("/api/intake")
def get_intake(user: Dict[str, Any] = Depends(get_current_user)):
    uid = user["uid"]
    snap = db.collection("users").document(uid).collection("intake").document("current").get()
    if not snap.exists:
        return {"intake": None}
    return {"intake": snap.to_dict()}


# -------- Routine (student-facing) --------
@app.get("/api/routine")
def get_my_routine(user: Dict[str, Any] = Depends(get_current_user)):
    uid = user["uid"]
    snap = db.collection("users").document(uid).collection("routine").document("current").get()
    if not snap.exists:
        return {"routine": None}
    return {"routine": snap.to_dict()}


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
    out = []
    for d in db.collection("users").stream():
        item = d.to_dict() or {}
        # Skip admins from the student list
        if item.get("is_admin") is True or item.get("role") == "admin":
            continue
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

    routine_snap = db.collection("users").document(uid).collection("routine").document("current").get()
    routine = routine_snap.to_dict() if routine_snap.exists else None

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

    return {"profile": profile, "intake": intake, "routine": routine,
            "photos": photos, "checkins": checkins, "notes": notes}


# -------- Admin: routine builder --------
class RoutineStepIn(BaseModel):
    step: int
    category: str
    productName: str
    brand: Optional[str] = ""
    amount: Optional[str] = ""
    frequency: Optional[str] = ""
    howTo: Optional[str] = ""
    description: Optional[str] = ""
    affiliateUrl: Optional[str] = ""
    imageUrl: Optional[str] = ""


class RoutineBlockIn(BaseModel):
    title: Optional[str] = "Morning Ritual"
    subtitle: Optional[str] = ""
    totalMinutes: Optional[int] = 5
    steps: List[RoutineStepIn] = []


class RoutineUpdate(BaseModel):
    morning: RoutineBlockIn
    evening: RoutineBlockIn
    rationale: List[str] = []


@app.put("/api/admin/students/{uid}/routine")
def admin_save_routine(uid: str, body: RoutineUpdate, user: Dict[str, Any] = Depends(get_admin_user)):
    """Save routine as draft (status=pending) without notifying student."""
    snap = db.collection("users").document(uid).get()
    if not snap.exists:
        raise HTTPException(404, "Student not found")
    routine_ref = db.collection("users").document(uid).collection("routine").document("current")
    cur = routine_ref.get().to_dict() or {}
    routine = {
        "morning": {"id": "morning", **body.morning.model_dump()},
        "evening": {"id": "evening", **body.evening.model_dump()},
        "rationale": body.rationale,
        "status": cur.get("status") or "pending",
        "updatedAt": utcnow_iso(),
        "updatedBy": user.get("name") or user.get("email"),
    }
    routine_ref.set(routine, merge=True)
    return {"ok": True, "routine": routine}


@app.post("/api/admin/students/{uid}/routine/publish")
def admin_publish_routine(uid: str, user: Dict[str, Any] = Depends(get_admin_user)):
    snap = db.collection("users").document(uid).get()
    if not snap.exists:
        raise HTTPException(404, "Student not found")
    routine_ref = db.collection("users").document(uid).collection("routine").document("current")
    cur = routine_ref.get()
    if not cur.exists:
        raise HTTPException(400, "No routine to publish — save a draft first.")
    routine_ref.set({
        "status": "published",
        "publishedAt": utcnow_iso(),
        "publishedBy": user.get("name") or user.get("email"),
    }, merge=True)
    return {"ok": True}


@app.post("/api/admin/students/{uid}/routine/unpublish")
def admin_unpublish_routine(uid: str, user: Dict[str, Any] = Depends(get_admin_user)):
    routine_ref = db.collection("users").document(uid).collection("routine").document("current")
    if not routine_ref.get().exists:
        raise HTTPException(404, "No routine")
    routine_ref.set({"status": "pending", "updatedAt": utcnow_iso()}, merge=True)
    return {"ok": True}


@app.post("/api/admin/students/{uid}/routine/draft")
def admin_generate_draft(uid: str, user: Dict[str, Any] = Depends(get_admin_user)):
    """Generate a starter draft from intake answers (admin only). Does not publish."""
    intake_snap = db.collection("users").document(uid).collection("intake").document("current").get()
    if not intake_snap.exists:
        raise HTTPException(400, "Student has not completed intake yet.")
    answers_dict = (intake_snap.to_dict() or {}).get("answers") or {}
    try:
        answers = IntakeAnswers(**answers_dict)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Invalid stored intake: {e}") from e
    routine = generate_routine(answers)
    routine_ref = db.collection("users").document(uid).collection("routine").document("current")
    cur = routine_ref.get().to_dict() or {}
    routine["status"] = cur.get("status") or "pending"
    routine["updatedAt"] = utcnow_iso()
    routine["updatedBy"] = user.get("name") or user.get("email")
    routine_ref.set(routine, merge=True)
    return {"ok": True, "routine": routine}


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
    is_admin: bool


@app.post("/api/admin/promote")
def admin_promote(body: PromoteBody, user: Dict[str, Any] = Depends(get_admin_user)):
    db.collection("users").document(body.uid).set({
        "is_admin": body.is_admin,
        "role": "admin" if body.is_admin else "student",  # legacy mirror
        "updatedAt": utcnow_iso(),
    }, merge=True)
    return {"ok": True}


# -------- Course (chapters + lessons) --------
class LessonResource(BaseModel):
    name: str
    size: Optional[str] = ""
    url: Optional[str] = ""


class Lesson(BaseModel):
    id: str
    title: str
    summary: Optional[str] = ""
    duration: Optional[str] = ""
    videoUrl: Optional[str] = ""
    longDescription: Optional[str] = ""
    resources: List[LessonResource] = []
    locked: bool = False


class Chapter(BaseModel):
    id: str
    title: str
    description: Optional[str] = ""
    lessons: List[Lesson] = []


class CourseDoc(BaseModel):
    title: Optional[str] = "The Clear Skin Protocol"
    subtitle: Optional[str] = "A 12-week guided transformation for calmer, healthier skin"
    estimatedHours: Optional[float] = 6.5
    chapters: List[Chapter] = []


@app.get("/api/course")
def get_course(user: Dict[str, Any] = Depends(get_current_user)):
    snap = db.collection("meta").document("course").get()
    if not snap.exists:
        return {"course": None}
    return {"course": snap.to_dict()}


@app.put("/api/admin/course")
def admin_update_course(body: CourseDoc, user: Dict[str, Any] = Depends(get_admin_user)):
    data = body.model_dump()
    data["updatedAt"] = utcnow_iso()
    data["updatedBy"] = user.get("name") or user.get("email")
    db.collection("meta").document("course").set(data)
    return {"ok": True, "course": data}

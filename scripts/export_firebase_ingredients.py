#!/usr/bin/env python3
"""
Export Firebase ingredient collections → ingredients-inci-v2.json

Usage:
  source venv/bin/activate
  python export_firebase_ingredients.py --cred /path/to/firebase-admin.json

Ce que fait ce script :
  1. Lit custom_ingredients   → ingrédients déjà classifiés par l'admin
                                 ajoutés directement au JSON (avec leur rôle)
  2. Lit unclassified_ingredients → ingrédients vus sans rôle
                                 tente de les scraper sur INCIDecoder
  3. Fusionne le tout dans ingredients-inci-v2.json (résumable)
"""

import argparse
import json
import re
import time
from pathlib import Path

# ── Config ─────────────────────────────────────────────────────────────────────

OUTPUT_JSON = Path(__file__).parent / "ingredients-inci-v2.json"
BASE_URL    = "https://incidecoder.com/ingredients/{slug}"
DELAY       = 1.5
HEADERS     = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# ── Slug helper ────────────────────────────────────────────────────────────────

def normalized_to_slug(name: str) -> str:
    """Convert Firestore normalized name (lowercase words) → INCIDecoder slug."""
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s\-/]", "", slug)
    slug = slug.replace("/", "-").replace(" ", "-")
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


# ── Scraper (same parser as main script) ──────────────────────────────────────

SKIP_PATTERNS = re.compile(
    r"^(Irritancy|Comedogenicity|What-it-does|Also called|cookie|©|CosIng|EWG|"
    r"Subscribe|Login|Sign|Search|Home|Menu|Decode|Your|We use)",
    re.IGNORECASE,
)

FUNCTION_TO_ROLE: dict[str, str] = {
    "emollient":                    "Émollient",
    "moisturizer/humectant":        "Humectant",
    "humectant":                    "Humectant",
    "solvent":                      "Solvant",
    "preservative":                 "Conservateur",
    "viscosity controlling":        "Épaississant",
    "viscosity stabilizer":         "Épaississant",
    "viscosity increasing":         "Épaississant",
    "emulsifying":                  "Émulsifiant",
    "emulsion stabilising":         "Émulsifiant",
    "emulsion stabilizer":          "Émulsifiant",
    "surfactant/cleansing":         "Tensioactif",
    "surfactant":                   "Tensioactif",
    "cleansing":                    "Tensioactif",
    "foaming":                      "Tensioactif",
    "sunscreen":                    "Filtre UV",
    "uv absorber":                  "Filtre UV",
    "uv filter":                    "Filtre UV",
    "antioxidant":                  "Antioxydant",
    "anti-acne":                    "Actif",
    "anti-aging":                   "Actif",
    "skin brightening":             "Actif",
    "wound healing":                "Actif",
    "skin conditioning":            "Actif",
    "tonic":                        "Actif",
    "astringent":                   "Actif",
    "keratolytic":                  "Exfoliant AHA",
    "exfoliant":                    "Exfoliant AHA",
    "soothing":                     "Apaisant",
    "skin-soothing":                "Apaisant",
    "anti-inflammatory":            "Apaisant",
    "calming":                      "Apaisant",
    "barrier":                      "Barrière",
    "skin-identical ingredient":    "Barrière",
    "film forming":                 "Texturant",
    "absorbent":                    "Texturant",
    "bulking":                      "Texturant",
    "opacifying":                   "Texturant",
    "chelating":                    "Chélateur",
    "buffering":                    "Régulateur pH",
    "ph adjuster":                  "Régulateur pH",
    "ph adjusting":                 "Régulateur pH",
    "sebum control":                "Sébo-régulateur",
    "mattifying":                   "Sébo-régulateur",
    "antimicrobial/antibacterial":  "Antibactérien",
    "antibacterial":                "Antibactérien",
    "deodorant":                    "Antibactérien",
    "perfuming":                    "Parfum",
    "fragrance":                    "Parfum",
    "depigmentation":               "Dépigmentant",
    "skin lightening":              "Dépigmentant",
    "lightening":                   "Dépigmentant",
}

ROLE_PRIORITY = [
    "Actif", "Exfoliant BHA", "Exfoliant AHA", "Exfoliant PHA",
    "Dépigmentant", "Sébo-régulateur", "Antioxydant", "Apaisant", "Barrière",
    "Filtre UV", "Humectant", "Émollient", "Émulsifiant", "Solvant",
    "Conservateur", "Tensioactif", "Antibactérien", "Épaississant",
    "Régulateur pH", "Chélateur", "Texturant", "Parfum",
]


def best_role(functions: list[str]) -> str | None:
    mapped = [FUNCTION_TO_ROLE[f.lower()] for f in functions if f.lower() in FUNCTION_TO_ROLE]
    if not mapped:
        return None
    for prio in ROLE_PRIORITY:
        if prio in mapped:
            return prio
    return mapped[0]


def parse_page(html: str, slug: str) -> dict:
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    full_text = soup.get_text(separator="\n", strip=True)
    result: dict = {"slug": slug, "found": True}

    h1 = soup.find("h1")
    result["name"] = h1.get_text(strip=True) if h1 else slug

    m = re.search(r"Irritancy[:\s]+(\d+)", full_text, re.IGNORECASE)
    result["irritancy"] = int(m.group(1)) if m else None

    m = re.search(r"Comedogenicity[:\s]+([\d]+(?:-[\d]+)?)", full_text, re.IGNORECASE)
    if m:
        raw = m.group(1)
        nums = [int(x) for x in raw.split("-") if x.isdigit()]
        result["comedogenicity"] = max(nums) if nums else None
    else:
        result["comedogenicity"] = None

    result["verdict"] = None
    lower = full_text.lower()
    for label in ["superstar", "good stuff", "it's complicated", "controversial", "caution", "icky", "avoid"]:
        if label in lower:
            result["verdict"] = label
            break

    functions: list[str] = []
    seen: set[str] = set()
    for a in soup.find_all("a", href=re.compile(r"/ingredient-functions/")):
        fn = a.get_text(strip=True).lower()
        if fn and fn not in seen:
            functions.append(fn)
            seen.add(fn)
    result["what_it_does"] = functions
    result["role_fr"] = best_role(functions)

    description = None
    for p in soup.find_all("p"):
        txt = p.get_text(strip=True)
        if len(txt) > 80 and not SKIP_PATTERNS.match(txt):
            description = txt
            break
    result["description_en"] = description
    return result


def scrape_slug(slug: str, session) -> dict:
    import requests
    url = BASE_URL.format(slug=slug)
    try:
        resp = session.get(url, headers=HEADERS, timeout=20)
        if resp.status_code == 404:
            return {"slug": slug, "found": False, "url": url}
        resp.raise_for_status()
        data = parse_page(resp.text, slug)
        data["url"] = url
        return data
    except requests.RequestException as e:
        return {"slug": slug, "found": False, "error": str(e), "url": url}


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Export Firebase ingredients → INCI JSON")
    parser.add_argument("--cred", required=True, help="Chemin vers firebase-admin.json")
    args = parser.parse_args()

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore as fs
    except ImportError:
        print("Installation de firebase-admin...")
        import subprocess, sys
        subprocess.check_call([sys.executable, "-m", "pip", "install", "firebase-admin"])
        import firebase_admin
        from firebase_admin import credentials, firestore as fs

    import requests

    # Init Firebase
    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.Certificate(args.cred))
    db = fs.client()

    # Charger JSON existant
    if OUTPUT_JSON.exists():
        with OUTPUT_JSON.open(encoding="utf-8") as f:
            results: dict = json.load(f)
        print(f"JSON existant : {len(results)} ingrédients\n")
    else:
        results = {}

    # ── 1. custom_ingredients (déjà classifiés) ───────────────────────────────
    print("Lecture custom_ingredients...")
    custom_snap = db.collection("custom_ingredients").get()
    custom_docs = [d.to_dict() for d in custom_snap]
    print(f"  {len(custom_docs)} ingrédients classifiés trouvés")

    added_custom = 0
    for doc in custom_docs:
        normalized = doc.get("normalized", "")
        if not normalized:
            continue
        slug = normalized_to_slug(normalized)
        if slug in results:
            # Mettre à jour le rôle si manquant
            if not results[slug].get("role_fr") and doc.get("role"):
                results[slug]["role_fr"] = doc["role"]
            continue
        results[slug] = {
            "slug": slug,
            "found": True,
            "inci_name": (doc.get("raw") or normalized).upper(),
            "role_fr": doc.get("role"),
            "source": "firebase_custom",
        }
        added_custom += 1

    print(f"  {added_custom} nouveaux ajoutés depuis custom_ingredients\n")

    # ── 2. unclassified_ingredients (à scraper) ───────────────────────────────
    print("Lecture unclassified_ingredients...")
    unclassified_snap = db.collection("unclassified_ingredients").order_by("count", direction=fs.Query.DESCENDING).get()
    unclassified_docs = [d.to_dict() for d in unclassified_snap]
    print(f"  {len(unclassified_docs)} ingrédients non classifiés trouvés")

    to_scrape = []
    for doc in unclassified_docs:
        normalized = doc.get("normalized", "")
        if not normalized:
            continue
        slug = normalized_to_slug(normalized)
        if slug not in results:
            to_scrape.append((slug, (doc.get("raw") or normalized).upper(), doc.get("count", 1)))

    print(f"  {len(to_scrape)} slugs nouveaux à scraper (triés par fréquence)\n")

    if not to_scrape:
        print("Rien à scraper.")
    else:
        session = requests.Session()
        for i, (slug, inci_name, count) in enumerate(to_scrape, 1):
            print(f"[{i:>3}/{len(to_scrape)}] {inci_name:<50} (vu {count}×)", end="", flush=True)
            data = scrape_slug(slug, session)
            data["inci_name"] = inci_name
            results[slug] = data

            with OUTPUT_JSON.open("w", encoding="utf-8") as f:
                json.dump(results, f, ensure_ascii=False, indent=2)

            if data.get("found"):
                parts = []
                if data.get("verdict"):    parts.append(data["verdict"])
                if data.get("role_fr"):    parts.append(f"→ {data['role_fr']}")
                print(" ✓  " + "  ".join(parts))
            else:
                print(" ✗  not found")

            if i < len(to_scrape):
                time.sleep(DELAY)

    # Résumé
    found = sum(1 for v in results.values() if v.get("found"))
    with_role = sum(1 for v in results.values() if v.get("role_fr"))
    print(f"\n{'─'*60}")
    print(f"✓ {found} trouvés  {with_role} avec rôle FR")
    print(f"Fichier : {OUTPUT_JSON.resolve()}")
    print("\nPour copier dans l'app :")
    print("  cp scripts/ingredients-inci-v2.json src/lib/inci-db.json")


if __name__ == "__main__":
    main()

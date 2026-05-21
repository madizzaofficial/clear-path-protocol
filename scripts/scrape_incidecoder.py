#!/usr/bin/env python3
"""
INCIDecoder scraper — Protocole Clear
Récupère description, irritancy, comedogenicity, verdict et fonctions
pour tous les ingrédients flagués dans cosmetic-ingredients.ts.

Usage:
  pip install requests beautifulsoup4
  python scripts/scrape_incidecoder.py

Sortie : scripts/ingredients-inci.json
Résumable : relancer après interruption, les slugs déjà fetchés sont ignorés.
"""

import json
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ── Config ─────────────────────────────────────────────────────────────────────

OUTPUT_FILE = Path(__file__).parent / "ingredients-inci.json"
BASE_URL = "https://incidecoder.com/ingredients/{slug}"
DELAY = 1.5  # secondes entre requêtes (soyons polis)
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

# ── Liste des ingrédients ──────────────────────────────────────────────────────
# Format : { "slug-incidecoder": "NOM INCI UPPERCASE" }
# Le slug = nom INCI lowercase avec espaces → tirets (heuristique + corrections manuelles)

INGREDIENTS: dict[str, str] = {

    # ─ Perturbateurs endocriniens — filtres UV ─────────────────────────────────
    "benzophenone-3":               "BENZOPHENONE-3",
    "oxybenzone":                   "OXYBENZONE",
    "homosalate":                   "HOMOSALATE",
    "ethylhexyl-methoxycinnamate":  "ETHYLHEXYL METHOXYCINNAMATE",
    "octinoxate":                   "OCTINOXATE",
    "4-methylbenzylidene-camphor":  "4-METHYLBENZYLIDENE CAMPHOR",
    "benzophenone-4":               "BENZOPHENONE-4",
    "sulisobenzone":                "SULISOBENZONE",
    "ethylhexyl-dimethyl-paba":     "ETHYLHEXYL DIMETHYL PABA",
    "drometrizole-trisiloxane":     "DROMETRIZOLE TRISILOXANE",

    # ─ Parabènes ───────────────────────────────────────────────────────────────
    "butylparaben":                 "BUTYLPARABEN",
    "isobutylparaben":              "ISOBUTYLPARABEN",
    "propylparaben":                "PROPYLPARABEN",
    "isopropylparaben":             "ISOPROPYLPARABEN",
    "methylparaben":                "METHYLPARABEN",
    "ethylparaben":                 "ETHYLPARABEN",
    "benzylparaben":                "BENZYLPARABEN",

    # ─ Antibactériens ──────────────────────────────────────────────────────────
    "triclosan":                    "TRICLOSAN",
    "triclocarban":                 "TRICLOCARBAN",

    # ─ Phtalates ───────────────────────────────────────────────────────────────
    "diethyl-phthalate":            "DIETHYL PHTHALATE",
    "dibutyl-phthalate":            "DIBUTYL PHTHALATE",
    "diisobutyl-phthalate":         "DIISOBUTYL PHTHALATE",

    # ─ Antioxydants / autres PE ────────────────────────────────────────────────
    "bha":                          "BHA",
    "resorcinol":                   "RESORCINOL",
    "p-phenylenediamine":           "P-PHENYLENEDIAMINE",
    "kojic-acid":                   "KOJIC ACID",

    # ─ Silicones cycliques ─────────────────────────────────────────────────────
    "cyclotetrasiloxane":           "CYCLOTETRASILOXANE",
    "cyclopentasiloxane":           "CYCLOPENTASILOXANE",

    # ─ Muscs nitrés ────────────────────────────────────────────────────────────
    "musk-ambrette":                "MUSK AMBRETTE",
    "musk-tibetene":                "MUSK TIBETENE",
    "musk-moskene":                 "MUSK MOSKENE",

    # ─ Allergènes EU obligatoires ──────────────────────────────────────────────
    "parfum":                       "PARFUM",
    "fragrance":                    "FRAGRANCE",
    "limonene":                     "LIMONENE",
    "linalool":                     "LINALOOL",
    "eugenol":                      "EUGENOL",
    "geraniol":                     "GERANIOL",
    "citronellol":                  "CITRONELLOL",
    "benzyl-alcohol":               "BENZYL ALCOHOL",
    "cinnamaldehyde":               "CINNAMALDEHYDE",
    "citral":                       "CITRAL",
    "coumarin":                     "COUMARIN",
    "farnesol":                     "FARNESOL",
    "hexyl-cinnamal":               "HEXYL CINNAMAL",
    "hydroxycitronellal":           "HYDROXYCITRONELLAL",
    "isoeugenol":                   "ISOEUGENOL",
    "amyl-cinnamal":                "AMYL CINNAMAL",
    "benzyl-salicylate":            "BENZYL SALICYLATE",
    "cinnamyl-alcohol":             "CINNAMYL ALCOHOL",
    "alpha-isomethyl-ionone":       "ALPHA-ISOMETHYL IONONE",
    "evernia-prunastri":            "EVERNIA PRUNASTRI",
    "evernia-furfuracea":           "EVERNIA FURFURACEA",
    "butylphenyl-methylpropional":  "BUTYLPHENYL METHYLPROPIONAL",
    "amylcinnamyl-alcohol":         "AMYLCINNAMYL ALCOHOL",
    "benzyl-benzoate":              "BENZYL BENZOATE",
    "benzyl-cinnamate":             "BENZYL CINNAMATE",
    "hexyl-cinnamal":               "HEXYL CINNAMAL",
    "methyl-2-octynoate":           "METHYL 2-OCTYNOATE",

    # ─ Irritants / tensioactifs ────────────────────────────────────────────────
    "sodium-lauryl-sulfate":        "SODIUM LAURYL SULFATE",
    "sodium-laureth-sulfate":       "SODIUM LAURETH SULFATE",
    "ammonium-lauryl-sulfate":      "AMMONIUM LAURYL SULFATE",
    "ammonium-laureth-sulfate":     "AMMONIUM LAURETH SULFATE",
    "alcohol-denat":                "ALCOHOL DENAT",
    "isopropyl-alcohol":            "ISOPROPYL ALCOHOL",
    "sodium-chloride":              "SODIUM CHLORIDE",

    # ─ Comédogènes ─────────────────────────────────────────────────────────────
    "isopropyl-myristate":          "ISOPROPYL MYRISTATE",
    "isopropyl-palmitate":          "ISOPROPYL PALMITATE",
    "myristyl-myristate":           "MYRISTYL MYRISTATE",
    "ethylhexyl-palmitate":         "ETHYLHEXYL PALMITATE",
    "octyl-stearate":               "OCTYL STEARATE",
    "octyl-palmitate":              "OCTYL PALMITATE",
    "cocos-nucifera-oil":           "COCOS NUCIFERA OIL",
    "theobroma-cacao-seed-butter":  "THEOBROMA CACAO SEED BUTTER",
    "lanolin-alcohol":              "LANOLIN ALCOHOL",
    "acetylated-lanolin":           "ACETYLATED LANOLIN",
    "acetylated-lanolin-alcohol":   "ACETYLATED LANOLIN ALCOHOL",
    "decyl-oleate":                 "DECYL OLEATE",
    "isopropyl-isostearate":        "ISOPROPYL ISOSTEARATE",
    "linum-usitatissimum-seed-oil": "LINUM USITATISSIMUM SEED OIL",
    "wheat-germ-oil":               "WHEAT GERM OIL",
    "triticum-vulgare-germ-oil":    "TRITICUM VULGARE GERM OIL",
    "laureth-4":                    "LAURETH-4",
    "myristic-acid":                "MYRISTIC ACID",
    "lauric-acid":                  "LAURIC ACID",
    "butyl-stearate":               "BUTYL STEARATE",
    "cetyl-acetate":                "CETYL ACETATE",
    "isostearyl-neopentanoate":     "ISOSTEARYL NEOPENTANOATE",

    # ─ Pétrochimiques ──────────────────────────────────────────────────────────
    "paraffinum-liquidum":          "PARAFFINUM LIQUIDUM",
    "petrolatum":                   "PETROLATUM",
    "mineral-oil":                  "MINERAL OIL",
    "cera-microcristallina":        "CERA MICROCRISTALLINA",
    "microcrystalline-wax":         "MICROCRYSTALLINE WAX",
    "isohexadecane":                "ISOHEXADECANE",
    "isododecane":                  "ISODODECANE",
    "polydecene":                   "POLYDECENE",
    "polyisobutene":                "POLYISOBUTENE",
}


# ── Parser ─────────────────────────────────────────────────────────────────────

VERDICT_PATTERNS = [
    ("superstar",       "superstar"),
    ("good stuff",      "good stuff"),
    ("it's complicated","it's complicated"),
    ("controversial",   "controversial"),
    ("caution",         "caution"),
    ("icky",            "icky"),
    ("avoid",           "avoid"),
]


def parse_page(html: str, slug: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    full_text = soup.get_text(separator="\n", strip=True)

    result: dict = {"slug": slug, "found": True}

    # Nom (h1)
    h1 = soup.find("h1")
    result["name"] = h1.get_text(strip=True) if h1 else slug

    # Irritancy
    m = re.search(r"Irritancy[:\s]+(\d+)", full_text, re.IGNORECASE)
    result["irritancy"] = int(m.group(1)) if m else None

    # Comedogenicity (peut être un range "3-5" → on garde le max)
    m = re.search(r"Comedogenicity[:\s]+([\d]+(?:-[\d]+)?)", full_text, re.IGNORECASE)
    if m:
        raw = m.group(1)
        result["comedogenicity_raw"] = raw
        nums = [int(x) for x in raw.split("-") if x.isdigit()]
        result["comedogenicity"] = max(nums) if nums else None
    else:
        result["comedogenicity"] = None
        result["comedogenicity_raw"] = None

    # Verdict (cherche les labels connus dans le texte)
    result["verdict"] = None
    lower = full_text.lower()
    for pattern, label in VERDICT_PATTERNS:
        if pattern in lower:
            result["verdict"] = label
            break

    # What-it-does — liens /ingredient-functions/
    functions = []
    seen = set()
    for a in soup.find_all("a", href=re.compile(r"/ingredient-functions/")):
        fn = a.get_text(strip=True).lower()
        if fn and fn not in seen:
            functions.append(fn)
            seen.add(fn)
    result["what_it_does"] = functions

    # Description — premier paragraphe substantiel qui n'est pas une ligne de rating
    SKIP_PATTERNS = re.compile(
        r"^(Irritancy|Comedogenicity|What-it-does|Also called|cookie|©|CosIng|EWG)",
        re.IGNORECASE,
    )
    description = None
    for p in soup.find_all("p"):
        txt = p.get_text(strip=True)
        if len(txt) > 80 and not SKIP_PATTERNS.match(txt):
            description = txt
            break
    result["description_en"] = description

    # Aliases (Also-called-like-this)
    aliases = []
    for line in full_text.splitlines():
        line = line.strip()
        if line.lower().startswith("also called") or line.lower().startswith("also-called"):
            # Extrait ce qui suit les deux-points
            parts = line.split(":", 1)
            if len(parts) == 2:
                aliases = [a.strip() for a in parts[1].split(",") if a.strip()]
    result["aliases"] = aliases

    return result


# ── Fetch ──────────────────────────────────────────────────────────────────────

def fetch(slug: str, session: requests.Session) -> dict:
    url = BASE_URL.format(slug=slug)
    try:
        resp = session.get(url, headers=HEADERS, timeout=20)
        if resp.status_code == 404:
            return {"slug": slug, "found": False, "url": url, "http_status": 404}
        resp.raise_for_status()
        data = parse_page(resp.text, slug)
        data["url"] = url
        return data
    except requests.RequestException as e:
        return {"slug": slug, "found": False, "error": str(e), "url": url}


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    # Charger les données existantes (reprise après interruption)
    if OUTPUT_FILE.exists():
        with OUTPUT_FILE.open(encoding="utf-8") as f:
            results: dict = json.load(f)
        print(f"Reprise — {len(results)} ingrédients déjà récupérés.\n")
    else:
        results = {}

    todo = [(slug, inci) for slug, inci in INGREDIENTS.items() if slug not in results]

    if not todo:
        print("Tout est déjà fetchés. Résultats dans :", OUTPUT_FILE)
        return

    print(f"À fetcher : {len(todo)} ingrédients\n")
    session = requests.Session()

    for i, (slug, inci_name) in enumerate(todo, 1):
        print(f"[{i:>3}/{len(todo)}] {inci_name:<45}", end="", flush=True)

        data = fetch(slug, session)
        data["inci_name"] = inci_name
        results[slug] = data

        # Sauvegarde après chaque fetch (résumable)
        with OUTPUT_FILE.open("w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        if data.get("found"):
            com = data.get("comedogenicity")
            irr = data.get("irritancy")
            verdict = data.get("verdict", "")
            parts = []
            if verdict:    parts.append(verdict)
            if irr is not None:  parts.append(f"irr={irr}")
            if com is not None:  parts.append(f"com={com}")
            print(" ✓  " + "  ".join(parts))
        else:
            print(" ✗  not found")

        if i < len(todo):
            time.sleep(DELAY)

    # Résumé final
    found = sum(1 for v in results.values() if v.get("found"))
    not_found = len(results) - found
    with_com = sum(1 for v in results.values() if v.get("comedogenicity") is not None)

    print(f"\n{'─' * 60}")
    print(f"✓ {found} trouvés   ✗ {not_found} non trouvés")
    print(f"  {with_com} ont un indice de comédogénicité")
    print(f"\nFichier de sortie : {OUTPUT_FILE.resolve()}")
    print()
    print("Prochaine étape :")
    print("  Vérifie le JSON, puis utilise-le pour mettre à jour")
    print("  les descriptions dans src/lib/cosmetic-ingredients.ts")


if __name__ == "__main__":
    main()

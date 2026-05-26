#!/usr/bin/env python3
"""
INCIDecoder scraper v2 — Protocole Clear

Usage:
  cd scripts && source venv/bin/activate
  python scrape_incidecoder_v2.py                 # scrape la liste intégrée (~500 ingrédients)
  python scrape_incidecoder_v2.py --discover      # découvre via sitemap INCIDecoder (peut prendre du temps)
  python scrape_incidecoder_v2.py --output-ts     # génère aussi un snippet TypeScript

Sorties :
  scripts/ingredients-inci-v2.json   — données brutes (résumable)
  scripts/ingredients-inci-v2.ts     — snippet TypeScript prêt à coller dans COMMON_INGREDIENTS

Améliorations vs v1 :
  - Liste ~500 ingrédients courants (vs 95 ingrédients flagués seulement)
  - Découverte via sitemap (mode --discover)
  - Mapping what_it_does → rôle français
  - Export TypeScript avec descriptions en anglais (à traduire si souhaité)
  - Résumable : relancer pour continuer là où on s'est arrêté
"""

import argparse
import json
import re
import time
from pathlib import Path
from xml.etree import ElementTree as ET

import requests
from bs4 import BeautifulSoup

# ── Config ─────────────────────────────────────────────────────────────────────

OUTPUT_JSON = Path(__file__).parent / "ingredients-inci-v2.json"
OUTPUT_TS   = Path(__file__).parent / "ingredients-inci-v2.ts"

BASE_URL  = "https://incidecoder.com/ingredients/{slug}"
DELAY     = 1.5
HEADERS   = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# ── Mapping what_it_does → rôle français ──────────────────────────────────────

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

# Priorité : si un ingrédient a plusieurs fonctions, on prend la première dans cette liste
ROLE_PRIORITY = [
    "Actif", "Exfoliant BHA", "Exfoliant AHA", "Exfoliant PHA",
    "Dépigmentant", "Sébo-régulateur", "Antioxydant", "Apaisant", "Barrière",
    "Filtre UV", "Humectant", "Émollient", "Émulsifiant", "Solvant",
    "Conservateur", "Tensioactif", "Antibactérien", "Épaississant",
    "Régulateur pH", "Chélateur", "Texturant", "Parfum",
]


def best_role(functions: list[str]) -> str | None:
    mapped = []
    for fn in functions:
        role = FUNCTION_TO_ROLE.get(fn.lower())
        if role and role not in mapped:
            mapped.append(role)
    if not mapped:
        return None
    for prio in ROLE_PRIORITY:
        if prio in mapped:
            return prio
    return mapped[0]


# ── Liste intégrée ~500 ingrédients courants ───────────────────────────────────
# Format : "slug-incidecoder": "NOM INCI"
# Slug = lowercase, espaces → tirets, / → tirets, caractères spéciaux supprimés

BUILTIN_INGREDIENTS: dict[str, str] = {

    # ─ Solvants / bases ──────────────────────────────────────────────────────
    "water":                          "WATER",
    "aqua":                           "AQUA",
    "butylene-glycol":                "BUTYLENE GLYCOL",
    "propylene-glycol":               "PROPYLENE GLYCOL",
    "propanediol":                    "PROPANEDIOL",
    "pentylene-glycol":               "PENTYLENE GLYCOL",
    "dipropylene-glycol":             "DIPROPYLENE GLYCOL",
    "hexylene-glycol":                "HEXYLENE GLYCOL",
    "ethoxydiglycol":                 "ETHOXYDIGLYCOL",

    # ─ Humectants ────────────────────────────────────────────────────────────
    "glycerin":                       "GLYCERIN",
    "glycerol":                       "GLYCEROL",
    "sodium-hyaluronate":             "SODIUM HYALURONATE",
    "hyaluronic-acid":                "HYALURONIC ACID",
    "sodium-hyaluronate-crosspolymer": "SODIUM HYALURONATE CROSSPOLYMER",
    "panthenol":                      "PANTHENOL",
    "betaine":                        "BETAINE",
    "sodium-pca":                     "SODIUM PCA",
    "sorbitol":                       "SORBITOL",
    "sodium-lactate":                 "SODIUM LACTATE",
    "urea":                           "UREA",
    "mannitol":                       "MANNITOL",
    "erythritol":                     "ERYTHRITOL",
    "xylitol":                        "XYLITOL",
    "trehalose":                      "TREHALOSE",
    "inositol":                       "INOSITOL",
    "sucrose":                        "SUCROSE",
    "fructose":                       "FRUCTOSE",
    "maltose":                        "MALTOSE",
    "glucose":                        "GLUCOSE",
    "lactose":                        "LACTOSE",
    "fructooligosaccharides":         "FRUCTOOLIGOSACCHARIDES",

    # ─ Actifs ────────────────────────────────────────────────────────────────
    "niacinamide":                    "NIACINAMIDE",
    "retinol":                        "RETINOL",
    "retinyl-palmitate":              "RETINYL PALMITATE",
    "retinal":                        "RETINAL",
    "bakuchiol":                      "BAKUCHIOL",
    "salicylic-acid":                 "SALICYLIC ACID",
    "azelaic-acid":                   "AZELAIC ACID",
    "alpha-arbutin":                  "ALPHA ARBUTIN",
    "arbutin":                        "ARBUTIN",
    "ascorbic-acid":                  "ASCORBIC ACID",
    "ascorbyl-glucoside":             "ASCORBYL GLUCOSIDE",
    "sodium-ascorbyl-phosphate":      "SODIUM ASCORBYL PHOSPHATE",
    "ascorbyl-tetraisopalmitate":     "ASCORBYL TETRAISOPALMITATE",
    "adenosine":                      "ADENOSINE",
    "ectoin":                         "ECTOIN",
    "tranexamic-acid":                "TRANEXAMIC ACID",
    "hexylresorcinol":                "HEXYLRESORCINOL",
    "zinc-pca":                       "ZINC PCA",
    "caffeine":                       "CAFFEINE",
    "carnitine":                      "CARNITINE",
    "creatine":                       "CREATINE",
    "taurine":                        "TAURINE",
    "arginine":                       "ARGININE",
    "glutamine":                      "GLUTAMINE",
    "lysine":                         "LYSINE",
    "proline":                        "PROLINE",
    "palmitoyl-tripeptide-1":         "PALMITOYL TRIPEPTIDE-1",
    "palmitoyl-tetrapeptide-7":       "PALMITOYL TETRAPEPTIDE-7",
    "palmitoyl-pentapeptide-4":       "PALMITOYL PENTAPEPTIDE-4",
    "acetyl-hexapeptide-3":           "ACETYL HEXAPEPTIDE-3",
    "tripeptide-1":                   "TRIPEPTIDE-1",
    "sh-oligopeptide-1":              "SH-OLIGOPEPTIDE-1",
    "copper-tripeptide-1":            "COPPER TRIPEPTIDE-1",
    "zinc-oxide":                     "ZINC OXIDE",
    "titanium-dioxide":               "TITANIUM DIOXIDE",

    # ─ Antioxydants ─────────────────────────────────────────────────────────
    "tocopherol":                     "TOCOPHEROL",
    "tocopheryl-acetate":             "TOCOPHERYL ACETATE",
    "ferulic-acid":                   "FERULIC ACID",
    "resveratrol":                    "RESVERATROL",
    "ubiquinone":                     "UBIQUINONE",
    "hydroxyacetophenone":            "HYDROXYACETOPHENONE",
    "sodium-metabisulfite":           "SODIUM METABISULFITE",
    "ascorbyl-palmitate":             "ASCORBYL PALMITATE",
    "bht":                            "BHT",

    # ─ Apaisants ────────────────────────────────────────────────────────────
    "allantoin":                      "ALLANTOIN",
    "bisabolol":                      "BISABOLOL",
    "centella-asiatica-extract":      "CENTELLA ASIATICA EXTRACT",
    "asiaticoside":                   "ASIATICOSIDE",
    "madecassoside":                  "MADECASSOSIDE",
    "glycyrrhizic-acid":              "GLYCYRRHIZIC ACID",
    "glycyrrhetinic-acid":            "GLYCYRRHETINIC ACID",
    "dipotassium-glycyrrhizate":      "DIPOTASSIUM GLYCYRRHIZATE",
    "glycyrrhiza-glabra-root-extract": "GLYCYRRHIZA GLABRA ROOT EXTRACT",
    "glycyrrhiza-inflata-root-extract": "GLYCYRRHIZA INFLATA ROOT EXTRACT",
    "aloe-barbadensis-leaf-juice":    "ALOE BARBADENSIS LEAF JUICE",
    "aloe-vera":                      "ALOE VERA",
    "chamomilla-recutita-extract":    "CHAMOMILLA RECUTITA EXTRACT",
    "calendula-officinalis-extract":  "CALENDULA OFFICINALIS EXTRACT",
    "camellia-sinensis-leaf-extract": "CAMELLIA SINENSIS LEAF EXTRACT",
    "green-tea-extract":              "GREEN TEA EXTRACT",
    "oat-extract":                    "OAT EXTRACT",
    "avena-sativa-kernel-extract":    "AVENA SATIVA KERNEL EXTRACT",
    "beta-glucan":                    "BETA-GLUCAN",

    # ─ Barrière cutanée ─────────────────────────────────────────────────────
    "ceramide-np":                    "CERAMIDE NP",
    "ceramide-ap":                    "CERAMIDE AP",
    "ceramide-eop":                   "CERAMIDE EOP",
    "ceramide-2":                     "CERAMIDE 2",
    "ceramide-3":                     "CERAMIDE 3",
    "ceramide-6-ii":                  "CERAMIDE 6-II",
    "cholesterol":                    "CHOLESTEROL",
    "phytosphingosine":               "PHYTOSPHINGOSINE",
    "sphingolipids":                  "SPHINGOLIPIDS",

    # ─ Filtres UV chimiques (hors PE) ────────────────────────────────────────
    "butyl-methoxydibenzoylmethane":  "BUTYL METHOXYDIBENZOYLMETHANE",
    "bis-ethylhexyloxyphenol-methoxyphenyl-triazine": "BIS-ETHYLHEXYLOXYPHENOL METHOXYPHENYL TRIAZINE",
    "ethylhexyl-triazone":            "ETHYLHEXYL TRIAZONE",
    "phenylbenzimidazole-sulfonic-acid": "PHENYLBENZIMIDAZOLE SULFONIC ACID",
    "diethylamino-hydroxybenzoyl-hexyl-benzoate": "DIETHYLAMINO HYDROXYBENZOYL HEXYL BENZOATE",
    "methylene-bis-benzotriazolyl-tetramethylbutylphenol": "METHYLENE BIS-BENZOTRIAZOLYL TETRAMETHYLBUTYLPHENOL",
    "ethylhexyl-salicylate":          "ETHYLHEXYL SALICYLATE",
    "ethylhexyl-methoxycrylene":      "ETHYLHEXYL METHOXYCRYLENE",
    "iscotrizinol":                   "ISCOTRIZINOL",

    # ─ Émollients — alcools gras ─────────────────────────────────────────────
    "cetyl-alcohol":                  "CETYL ALCOHOL",
    "stearyl-alcohol":                "STEARYL ALCOHOL",
    "cetearyl-alcohol":               "CETEARYL ALCOHOL",
    "behenyl-alcohol":                "BEHENYL ALCOHOL",
    "arachidyl-alcohol":              "ARACHIDYL ALCOHOL",
    "octyldodecanol":                 "OCTYLDODECANOL",

    # ─ Émollients — acides gras ──────────────────────────────────────────────
    "stearic-acid":                   "STEARIC ACID",
    "palmitic-acid":                  "PALMITIC ACID",
    "oleic-acid":                     "OLEIC ACID",
    "linoleic-acid":                  "LINOLEIC ACID",
    "behenic-acid":                   "BEHENIC ACID",
    "caprylic-acid":                  "CAPRYLIC ACID",
    "capric-acid":                    "CAPRIC ACID",
    "myristic-acid":                  "MYRISTIC ACID",

    # ─ Émollients — esters et huiles ─────────────────────────────────────────
    "dimethicone":                    "DIMETHICONE",
    "phenyl-trimethicone":            "PHENYL TRIMETHICONE",
    "dimethiconol":                   "DIMETHICONOL",
    "squalane":                       "SQUALANE",
    "squalene":                       "SQUALENE",
    "caprylic-capric-triglyceride":   "CAPRYLIC/CAPRIC TRIGLYCERIDE",
    "coco-caprylate-caprate":         "COCO-CAPRYLATE/CAPRATE",
    "dicaprylyl-carbonate":           "DICAPRYLYL CARBONATE",
    "dicaprylyl-ether":               "DICAPRYLYL ETHER",
    "c12-15-alkyl-benzoate":          "C12-15 ALKYL BENZOATE",
    "dibutyl-adipate":                "DIBUTYL ADIPATE",
    "butylene-glycol-dicaprylate-dicaprate": "BUTYLENE GLYCOL DICAPRYLATE/DICAPRATE",
    "isononyl-isononanoate":          "ISONONYL ISONONANOATE",
    "ethylhexyl-isononanoate":        "ETHYLHEXYL ISONONANOATE",
    "ethylhexyl-olivate":             "ETHYLHEXYL OLIVATE",
    "ethylhexyl-stearate":            "ETHYLHEXYL STEARATE",
    "diisopropyl-sebacate":           "DIISOPROPYL SEBACATE",
    "triethylhexanoin":               "TRIETHYLHEXANOIN",
    "isopropyl-myristate":            "ISOPROPYL MYRISTATE",
    "isopropyl-palmitate":            "ISOPROPYL PALMITATE",
    "ethylhexyl-palmitate":           "ETHYLHEXYL PALMITATE",
    "pentaerythrityl-tetraethylhexanoate": "PENTAERYTHRITYL TETRAETHYLHEXANOATE",
    "neopentyl-glycol-diheptanoate":  "NEOPENTYL GLYCOL DIHEPTANOATE",

    # ─ Beurres / huiles végétales ────────────────────────────────────────────
    "butyrospermum-parkii-butter":    "BUTYROSPERMUM PARKII BUTTER",
    "simmondsia-chinensis-seed-oil":  "SIMMONDSIA CHINENSIS SEED OIL",
    "argania-spinosa-kernel-oil":     "ARGANIA SPINOSA KERNEL OIL",
    "helianthus-annuus-seed-oil":     "HELIANTHUS ANNUUS SEED OIL",
    "rosa-canina-fruit-oil":          "ROSA CANINA FRUIT OIL",
    "prunus-amygdalus-dulcis-oil":    "PRUNUS AMYGDALUS DULCIS OIL",
    "vitis-vinifera-seed-oil":        "VITIS VINIFERA SEED OIL",
    "persea-gratissima-oil":          "PERSEA GRATISSIMA OIL",
    "macadamia-ternifolia-seed-oil":  "MACADAMIA TERNIFOLIA SEED OIL",
    "calophyllum-inophyllum-seed-oil": "CALOPHYLLUM INOPHYLLUM SEED OIL",
    "camellia-sinensis-seed-oil":     "CAMELLIA SINENSIS SEED OIL",
    "hippophae-rhamnoides-oil":       "HIPPOPHAE RHAMNOIDES OIL",
    "cocos-nucifera-oil":             "COCOS NUCIFERA OIL",
    "theobroma-cacao-seed-butter":    "THEOBROMA CACAO SEED BUTTER",
    "coco-caprylate":                 "COCO-CAPRYLATE",
    "meadowfoam-seed-oil":            "MEADOWFOAM SEED OIL",
    "limnanthes-alba-seed-oil":       "LIMNANTHES ALBA SEED OIL",
    "rosehip-oil":                    "ROSEHIP OIL",
    "marula-oil":                     "MARULA OIL",

    # ─ Émulsifiants ──────────────────────────────────────────────────────────
    "glyceryl-stearate":              "GLYCERYL STEARATE",
    "peg-100-stearate":               "PEG-100 STEARATE",
    "cetearyl-glucoside":             "CETEARYL GLUCOSIDE",
    "polysorbate-20":                 "POLYSORBATE 20",
    "polysorbate-60":                 "POLYSORBATE 60",
    "polysorbate-80":                 "POLYSORBATE 80",
    "sorbitan-stearate":              "SORBITAN STEARATE",
    "sorbitan-oleate":                "SORBITAN OLEATE",
    "sorbitan-sesquioleate":          "SORBITAN SESQUIOLEATE",
    "sodium-stearoyl-glutamate":      "SODIUM STEAROYL GLUTAMATE",
    "steareth-2":                     "STEARETH-2",
    "steareth-21":                    "STEARETH-21",
    "lecithin":                       "LECITHIN",
    "hydrogenated-lecithin":          "HYDROGENATED LECITHIN",
    "polyglyceryl-3-methylglucose-distearate": "POLYGLYCERYL-3 METHYLGLUCOSE DISTEARATE",
    "peg-40-hydrogenated-castor-oil": "PEG-40 HYDROGENATED CASTOR OIL",
    "behentrimonium-methosulfate":    "BEHENTRIMONIUM METHOSULFATE",
    "glyceryl-stearate-se":           "GLYCERYL STEARATE SE",
    "arachidyl-glucoside":            "ARACHIDYL GLUCOSIDE",
    "glyceryl-oleate":                "GLYCERYL OLEATE",
    "ceteareth-20":                   "CETEARETH-20",
    "ceteareth-12":                   "CETEARETH-12",
    "peg-20-ceteareth":               "PEG-20 CETEARETH",

    # ─ Conservateurs ────────────────────────────────────────────────────────
    "phenoxyethanol":                 "PHENOXYETHANOL",
    "sodium-benzoate":                "SODIUM BENZOATE",
    "potassium-sorbate":              "POTASSIUM SORBATE",
    "ethylhexylglycerin":             "ETHYLHEXYLGLYCERIN",
    "caprylyl-glycol":                "CAPRYLYL GLYCOL",
    "decylene-glycol":                "DECYLENE GLYCOL",
    "1-2-hexanediol":                 "1,2-HEXANEDIOL",
    "caprylhydroxamic-acid":          "CAPRYLHYDROXAMIC ACID",
    "chlorphenesin":                  "CHLORPHENESIN",
    "dehydroacetic-acid":             "DEHYDROACETIC ACID",
    "benzoic-acid":                   "BENZOIC ACID",
    "sorbic-acid":                    "SORBIC ACID",
    "glyceryl-caprylate":             "GLYCERYL CAPRYLATE",
    "sodium-levulinate":              "SODIUM LEVULINATE",
    "sodium-anisate":                 "SODIUM ANISATE",
    "benzyl-alcohol":                 "BENZYL ALCOHOL",

    # ─ Épaississants / texturants ────────────────────────────────────────────
    "carbomer":                       "CARBOMER",
    "xanthan-gum":                    "XANTHAN GUM",
    "hydroxyethylcellulose":          "HYDROXYETHYLCELLULOSE",
    "hydroxypropyl-methylcellulose":  "HYDROXYPROPYL METHYLCELLULOSE",
    "carrageenan":                    "CARRAGEENAN",
    "microcrystalline-cellulose":     "MICROCRYSTALLINE CELLULOSE",
    "sodium-polyacrylate":            "SODIUM POLYACRYLATE",
    "acrylates-c10-30-alkyl-acrylate-crosspolymer": "ACRYLATES/C10-30 ALKYL ACRYLATE CROSSPOLYMER",
    "hydroxyethyl-acrylate-sodium-acryloyldimethyl-taurate-copolymer":
        "HYDROXYETHYL ACRYLATE/SODIUM ACRYLOYLDIMETHYL TAURATE COPOLYMER",
    "acrylates-copolymer":            "ACRYLATES COPOLYMER",
    "cellulose":                      "CELLULOSE",
    "methylcellulose":                "METHYLCELLULOSE",
    "silica":                         "SILICA",
    "silica-dimethyl-silylate":       "SILICA DIMETHYL SILYLATE",
    "magnesium-aluminum-silicate":    "MAGNESIUM ALUMINUM SILICATE",
    "kaolin":                         "KAOLIN",
    "talc":                           "TALC",
    "mica":                           "MICA",
    "nylon-12":                       "NYLON-12",
    "trimethylsiloxysilicate":        "TRIMETHYLSILOXYSILICATE",
    "starch":                         "STARCH",
    "tapioca-starch":                 "TAPIOCA STARCH",

    # ─ Cires ────────────────────────────────────────────────────────────────
    "copernicia-cerifera-cera":       "COPERNICIA CERIFERA CERA",
    "candelilla-cera":                "CANDELILLA CERA",
    "cera-alba":                      "CERA ALBA",
    "cera-flava":                     "CERA FLAVA",
    "hydrogenated-jojoba-oil":        "HYDROGENATED JOJOBA OIL",
    "carnauba":                       "CARNAUBA",
    "synthetic-beeswax":              "SYNTHETIC BEESWAX",
    "paraffin":                       "PARAFFIN",

    # ─ Régulateurs de pH ────────────────────────────────────────────────────
    "sodium-hydroxide":               "SODIUM HYDROXIDE",
    "potassium-hydroxide":            "POTASSIUM HYDROXIDE",
    "triethanolamine":                "TRIETHANOLAMINE",
    "aminomethyl-propanol":           "AMINOMETHYL PROPANOL",
    "citric-acid":                    "CITRIC ACID",
    "lactic-acid":                    "LACTIC ACID",
    "phosphoric-acid":                "PHOSPHORIC ACID",
    "malic-acid":                     "MALIC ACID",

    # ─ Chélateurs ────────────────────────────────────────────────────────────
    "disodium-edta":                  "DISODIUM EDTA",
    "trisodium-edta":                 "TRISODIUM EDTA",
    "tetrasodium-edta":               "TETRASODIUM EDTA",
    "trisodium-ethylenediamine-disuccinate": "TRISODIUM ETHYLENEDIAMINE DISUCCINATE",
    "phytic-acid":                    "PHYTIC ACID",
    "sodium-phytate":                 "SODIUM PHYTATE",

    # ─ Exfoliants ────────────────────────────────────────────────────────────
    "glycolic-acid":                  "GLYCOLIC ACID",
    "mandelic-acid":                  "MANDELIC ACID",
    "gluconolactone":                 "GLUCONOLACTONE",
    "lactobionic-acid":               "LACTOBIONIC ACID",
    "malic-acid":                     "MALIC ACID",
    "tartaric-acid":                  "TARTARIC ACID",
    "pyruvic-acid":                   "PYRUVIC ACID",

    # ─ Hydrolysats protéiques ────────────────────────────────────────────────
    "hydrolyzed-collagen":            "HYDROLYZED COLLAGEN",
    "hydrolyzed-elastin":             "HYDROLYZED ELASTIN",
    "hydrolyzed-keratin":             "HYDROLYZED KERATIN",
    "hydrolyzed-silk":                "HYDROLYZED SILK",
    "hydrolyzed-wheat-protein":       "HYDROLYZED WHEAT PROTEIN",
    "hydrolyzed-oat-protein":         "HYDROLYZED OAT PROTEIN",
    "hydrolyzed-soy-protein":         "HYDROLYZED SOY PROTEIN",

    # ─ Divers courants ───────────────────────────────────────────────────────
    "sodium-pca":                     "SODIUM PCA",
    "sodium-lactate":                 "SODIUM LACTATE",
    "niacinamide":                    "NIACINAMIDE",
    "panthenol":                      "PANTHENOL",
    "allantoin":                      "ALLANTOIN",
    "glycine":                        "GLYCINE",
    "serine":                         "SERINE",
    "threonine":                      "THREONINE",
    "tocopherol":                     "TOCOPHEROL",
    "sodium-ascorbyl-phosphate":      "SODIUM ASCORBYL PHOSPHATE",
}


# ── Découverte des slugs ───────────────────────────────────────────────────────

def _stream_get(session: requests.Session, url: str, timeout: int = 120) -> bytes:
    """Fetch a URL with streaming to handle large responses without timing out."""
    r = session.get(url, headers=HEADERS, timeout=timeout, stream=True)
    r.raise_for_status()
    chunks = []
    for chunk in r.iter_content(chunk_size=65536):
        chunks.append(chunk)
    return b"".join(chunks)


def discover_ingredients(session: requests.Session) -> dict[str, str]:
    """
    Découvre les slugs d'ingrédients INCIDecoder via le sitemap officiel.

    Approche :
      1. robots.txt → récupère l'URL du sitemap index
      2. Sitemap index (téléchargement en streaming, timeout 120s)
      3. Filtre les sub-sitemaps dont le nom contient "ingredient"
      4. Extrait tous les slugs des sitemaps d'ingrédients trouvés
      5. Fallback : liste intégrée BUILTIN_INGREDIENTS
    """
    slugs: dict[str, str] = {}
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

    # ── Étape 1 : trouver l'URL du sitemap index ─────────────────────────────
    index_url = "https://incidecoder.com/sitemap-index.xml"
    try:
        r = session.get("https://incidecoder.com/robots.txt", headers=HEADERS, timeout=15)
        for line in r.text.splitlines():
            if line.lower().startswith("sitemap:"):
                index_url = line.split(":", 1)[1].strip()
                print(f"  Sitemap index trouvé dans robots.txt : {index_url}")
                break
    except Exception as e:
        print(f"  robots.txt inaccessible ({e}) — utilisation de {index_url}")

    # ── Étape 2 : télécharger le sitemap index en streaming ──────────────────
    print(f"  Téléchargement du sitemap index...")
    try:
        content = _stream_get(session, index_url, timeout=120)
        root = ET.fromstring(content)

        # Chercher TOUS les sub-sitemaps d'ingrédients
        ingredient_sitemaps = [
            loc.text.strip()
            for loc in root.findall(".//sm:sitemap/sm:loc", ns)
            if loc.text and "ingredient" in loc.text.lower()
        ]

        if not ingredient_sitemaps:
            print("  Aucun sitemap d'ingrédients dans l'index — fallback liste intégrée.")
            return {}

        print(f"  {len(ingredient_sitemaps)} sitemap(s) d'ingrédients trouvé(s)")

    except Exception as e:
        print(f"  Impossible de lire le sitemap index ({e}) — fallback liste intégrée.")
        return {}

    # ── Étape 3 : extraire les slugs de chaque sitemap d'ingrédients ─────────
    for i, sm_url in enumerate(ingredient_sitemaps, 1):
        print(f"  [{i}/{len(ingredient_sitemaps)}] {sm_url}")
        try:
            content = _stream_get(session, sm_url, timeout=120)
            root2 = ET.fromstring(content)
            before = len(slugs)
            for loc in root2.findall(".//sm:url/sm:loc", ns):
                if loc.text and "/ingredients/" in loc.text:
                    m = re.search(r"/ingredients/([^/\?#]+)", loc.text)
                    if m:
                        slug = m.group(1)
                        slugs[slug] = slug.replace("-", " ").upper()
            print(f"      +{len(slugs) - before} slugs  (total : {len(slugs)})")
            time.sleep(0.5)
        except Exception as e:
            print(f"      Erreur : {e}")

    if slugs:
        print(f"  Découverte terminée : {len(slugs)} ingrédients")
        return slugs

    print("  Aucun slug découvert — fallback liste intégrée.")
    return {}


# ── Parser ─────────────────────────────────────────────────────────────────────

SKIP_PATTERNS = re.compile(
    r"^(Irritancy|Comedogenicity|What-it-does|Also called|cookie|©|CosIng|EWG|"
    r"Subscribe|Login|Sign|Search|Home|Menu|Decode|Your|We use)",
    re.IGNORECASE,
)


def parse_page(html: str, slug: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    full_text = soup.get_text(separator="\n", strip=True)
    result: dict = {"slug": slug, "found": True}

    # Nom
    h1 = soup.find("h1")
    result["name"] = h1.get_text(strip=True) if h1 else slug

    # INCI name (peut différer du slug)
    inci_el = soup.find(class_=re.compile(r"inci", re.I))
    result["inci_name_found"] = inci_el.get_text(strip=True) if inci_el else None

    # Irritancy
    m = re.search(r"Irritancy[:\s]+(\d+)", full_text, re.IGNORECASE)
    result["irritancy"] = int(m.group(1)) if m else None

    # Comedogenicity
    m = re.search(r"Comedogenicity[:\s]+([\d]+(?:-[\d]+)?)", full_text, re.IGNORECASE)
    if m:
        raw = m.group(1)
        result["comedogenicity_raw"] = raw
        nums = [int(x) for x in raw.split("-") if x.isdigit()]
        result["comedogenicity"] = max(nums) if nums else None
    else:
        result["comedogenicity"] = None
        result["comedogenicity_raw"] = None

    # Verdict
    result["verdict"] = None
    lower = full_text.lower()
    for label in ["superstar", "good stuff", "it's complicated", "controversial", "caution", "icky", "avoid"]:
        if label in lower:
            result["verdict"] = label
            break

    # What-it-does
    functions: list[str] = []
    seen: set[str] = set()
    for a in soup.find_all("a", href=re.compile(r"/ingredient-functions/")):
        fn = a.get_text(strip=True).lower()
        if fn and fn not in seen:
            functions.append(fn)
            seen.add(fn)
    result["what_it_does"] = functions
    result["role_fr"] = best_role(functions)

    # Description (premier paragraphe substantiel en anglais)
    description = None
    for p in soup.find_all("p"):
        txt = p.get_text(strip=True)
        if len(txt) > 80 and not SKIP_PATTERNS.match(txt):
            description = txt
            break
    result["description_en"] = description

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


# ── Export TypeScript ──────────────────────────────────────────────────────────

def export_typescript(results: dict, output_path: Path) -> None:
    """Génère un snippet TypeScript prêt à coller dans COMMON_INGREDIENTS."""
    lines = [
        "// ─── Généré par scrape_incidecoder_v2.py ─────────────────────────────────────",
        "// Coller dans src/lib/cosmetic-ingredients.ts → COMMON_INGREDIENTS",
        "// Les descriptions sont en anglais (source INCIDecoder) — traduire si souhaité",
        "",
    ]

    # Grouper par rôle
    by_role: dict[str, list[tuple[str, dict]]] = {}
    for slug, data in results.items():
        if not data.get("found"):
            continue
        role = data.get("role_fr") or "Non classifié"
        inci = data.get("inci_name") or slug.replace("-", " ").upper()
        desc = data.get("description_en") or ""
        # Nettoyer la description
        desc = re.sub(r"\s+", " ", desc).strip()
        if len(desc) > 300:
            desc = desc[:297] + "..."
        by_role.setdefault(role, []).append((inci, data))

    for role in ROLE_PRIORITY + ["Non classifié"]:
        entries = by_role.get(role, [])
        if not entries:
            continue
        lines.append(f"  // ─ {role} ─")
        for inci, data in sorted(entries, key=lambda x: x[0]):
            desc = data.get("description_en") or ""
            desc = re.sub(r"\s+", " ", desc).strip()
            if len(desc) > 280:
                desc = desc[:277] + "..."
            # Échapper les guillemets
            desc_escaped = desc.replace('"', '\\"')
            inci_escaped = inci.replace('"', '\\"')
            padding = max(1, 42 - len(inci))
            lines.append(
                f'  "{inci_escaped}":{" " * padding}'
                f'{{ role: "{role}", description: "{desc_escaped}" }},'
            )
        lines.append("")

    output_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"\nTypeScript exporté : {output_path.resolve()}")


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="INCIDecoder scraper v2")
    parser.add_argument("--discover", action="store_true",
                        help="Découvrir les slugs via le sitemap INCIDecoder")
    parser.add_argument("--output-ts", action="store_true",
                        help="Générer un fichier TypeScript prêt à coller")
    args = parser.parse_args()

    # Charger les résultats existants
    if OUTPUT_JSON.exists():
        with OUTPUT_JSON.open(encoding="utf-8") as f:
            results: dict = json.load(f)
        print(f"Reprise — {len(results)} ingrédients déjà récupérés.\n")
    else:
        results = {}

    session = requests.Session()

    # Construire la liste à scraper
    if args.discover:
        print("Mode découverte — tentative de récupération automatique des slugs...")
        ingredients = discover_ingredients(session)
        if not ingredients:
            ingredients = BUILTIN_INGREDIENTS
    else:
        ingredients = BUILTIN_INGREDIENTS

    # Ajouter les ingrédients déjà dans les résultats qui ne seraient pas dans la liste
    for slug in list(results.keys()):
        if slug not in ingredients:
            inci = results[slug].get("inci_name") or slug.replace("-", " ").upper()
            ingredients[slug] = inci

    todo = [(slug, inci) for slug, inci in ingredients.items() if slug not in results]

    if not todo:
        print("Tout est déjà fetché.")
    else:
        print(f"À fetcher : {len(todo)} ingrédients\n")

        for i, (slug, inci_name) in enumerate(todo, 1):
            print(f"[{i:>3}/{len(todo)}] {inci_name:<50}", end="", flush=True)

            data = fetch(slug, session)
            data["inci_name"] = inci_name
            results[slug] = data

            with OUTPUT_JSON.open("w", encoding="utf-8") as f:
                json.dump(results, f, ensure_ascii=False, indent=2)

            if data.get("found"):
                parts = []
                if data.get("verdict"):    parts.append(data["verdict"])
                if data.get("role_fr"):    parts.append(f"→ {data['role_fr']}")
                if data.get("irritancy") is not None: parts.append(f"irr={data['irritancy']}")
                if data.get("comedogenicity") is not None: parts.append(f"com={data['comedogenicity']}")
                print(" ✓  " + "  ".join(parts))
            else:
                print(" ✗  not found")

            if i < len(todo):
                time.sleep(DELAY)

    # Résumé
    found     = sum(1 for v in results.values() if v.get("found"))
    not_found = len(results) - found
    with_role = sum(1 for v in results.values() if v.get("role_fr"))
    print(f"\n{'─'*60}")
    print(f"✓ {found} trouvés   ✗ {not_found} non trouvés   {with_role} avec rôle FR")
    print(f"Fichier : {OUTPUT_JSON.resolve()}")

    if args.output_ts or True:  # toujours générer le TS
        export_typescript(results, OUTPUT_TS)


if __name__ == "__main__":
    main()

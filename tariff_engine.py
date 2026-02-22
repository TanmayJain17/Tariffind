"""
TariffShield — Tariff Intelligence Engine (CSV-Backed)
======================================================
Loads the real USITC HTS 2026 Revision 3 CSV for full product coverage.
Layers on surcharges: Section 301, Section 232, IEEPA fentanyl, Section 122.

Post-SCOTUS (Feb 20, 2026):
  - STRUCK DOWN: Broad IEEPA "reciprocal" tariffs (Liberation Day etc.)
  - SURVIVES: Section 301 (China), Section 232 (steel/aluminum/autos),
              IEEPA fentanyl (China, 20%), new Section 122 blanket (10% global)
"""

import os
import re
import pandas as pd
from dataclasses import dataclass, field
from typing import Optional


# ─────────────────────────────────────────────
# CSV LOADER
# ─────────────────────────────────────────────

_hts_df: Optional[pd.DataFrame] = None

DEFAULT_CSV_PATH = os.path.join(os.path.dirname(__file__), "data", "hts_2026_revision_3_csv.csv")


def load_hts_csv(csv_path: str = None) -> pd.DataFrame:
    global _hts_df
    if _hts_df is not None:
        return _hts_df

    path = csv_path or DEFAULT_CSV_PATH
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"HTS CSV not found at {path}. "
            f"Place hts_2026_revision_3_csv.csv in the data/ folder."
        )

    df = pd.read_csv(path, encoding="utf-8-sig", dtype=str)
    df.columns = [c.strip() for c in df.columns]
    df["HTS Number"] = df["HTS Number"].fillna("").str.strip()
    df["_norm"] = df["HTS Number"].str.replace(".", "", regex=False).str.strip()
    df = df[df["HTS Number"] != ""].copy()

    _hts_df = df
    print(f"[TariffShield] Loaded {len(df):,} HTS entries from CSV.")
    return df


def find_hts_entry(hts_code: str, df: pd.DataFrame = None) -> Optional[pd.Series]:
    if df is None:
        df = load_hts_csv()

    target = hts_code.replace(".", "").replace(" ", "")

    for length in [len(target), 10, 8, 6, 4]:
        prefix = target[:length]
        matches = df[df["_norm"].str.startswith(prefix)]
        if matches.empty:
            continue
        with_rate = matches[
            matches["General Rate of Duty"].notna()
            & (matches["General Rate of Duty"].str.strip() != "")
        ]
        if not with_rate.empty:
            return with_rate.iloc[0]
        return matches.iloc[0]

    return None


# ─────────────────────────────────────────────
# RATE PARSER
# ─────────────────────────────────────────────

def parse_rate(rate_str: str) -> float:
    if not isinstance(rate_str, str):
        return 0.0
    s = rate_str.strip()
    if not s or s.lower() == "free":
        return 0.0
    pct_matches = re.findall(r"([\d.]+)\s*%", s)
    if pct_matches:
        return max(float(p) for p in pct_matches) / 100.0
    return 0.0


# ─────────────────────────────────────────────
# CATEGORIES
# ─────────────────────────────────────────────

CATEGORIES = {
    "electronics":    ["84", "85"],
    "furniture":      ["94"],
    "clothing":       ["61", "62", "63"],
    "auto_parts":     ["87"],
    "steel_aluminum": ["72", "73", "76"],
    "toys":           ["95"],
}

CATEGORY_LABELS = {
    "electronics":    "Electronics & Electrical Equipment",
    "furniture":      "Furniture & Home Furnishings",
    "clothing":       "Clothing & Textiles",
    "auto_parts":     "Vehicles & Auto Parts",
    "steel_aluminum": "Steel & Aluminum Products",
    "toys":           "Toys, Games & Sports Equipment",
    "other":          "Other Goods",
}


def get_category(hts_code: str) -> str:
    clean = hts_code.replace(".", "").replace(" ", "")
    for cat, prefixes in CATEGORIES.items():
        for prefix in prefixes:
            if clean.startswith(prefix):
                return cat
    return "other"


# ─────────────────────────────────────────────
# SECTION 301 (China only)
# ─────────────────────────────────────────────

SECTION_301_CHINA = {
    "84": 0.25, "85": 0.25,
    "94": 0.25, "87": 0.25,
    "72": 0.25, "73": 0.25, "76": 0.25,
    "61": 0.075, "62": 0.075, "63": 0.075,
    "95": 0.075,
}


def get_section_301_rate(hts_code: str, country_iso2: str) -> float:
    if country_iso2.upper() != "CN":
        return 0.0
    clean = hts_code.replace(".", "").replace(" ", "")
    for length in [4, 2]:
        prefix = clean[:length]
        if prefix in SECTION_301_CHINA:
            return SECTION_301_CHINA[prefix]
    return 0.0


# ─────────────────────────────────────────────
# SECTION 232 (Steel/Aluminum/Autos — ALL countries, 25%)
# ─────────────────────────────────────────────

SECTION_232_CHAPTERS = {"72", "73", "76"}
SECTION_232_AUTO_HEADINGS = {"8703", "8704"}


def get_section_232_rate(hts_code: str) -> float:
    clean = hts_code.replace(".", "").replace(" ", "")
    if clean[:2] in SECTION_232_CHAPTERS:
        return 0.25
    if clean[:4] in SECTION_232_AUTO_HEADINGS:
        return 0.25
    return 0.0


# ─────────────────────────────────────────────
# IEEPA FENTANYL (China only, 20%)
# ─────────────────────────────────────────────

def get_ieepa_fentanyl_rate(country_iso2: str) -> float:
    return 0.20 if country_iso2.upper() == "CN" else 0.0


# ─────────────────────────────────────────────
# SECTION 122 BLANKET (10% global — NEW Feb 20, 2026)
# ─────────────────────────────────────────────

SECTION_122_RATE = 0.10


# ─────────────────────────────────────────────
# FTA / USMCA
# ─────────────────────────────────────────────

USMCA_COUNTRIES = {"CA", "MX"}
FTA_PARTNERS = {"AU", "BH", "CL", "CO", "KR", "MA", "OM", "PA", "PE", "SG", "IL", "JO"}


def adjust_mfn_for_fta(country_iso2: str, mfn_rate: float,
                        special_rate_str: str = None) -> tuple[float, str]:
    country = country_iso2.upper()

    if special_rate_str and isinstance(special_rate_str, str):
        s = special_rate_str.strip()
        if country == "CA" and ("CA" in s) and ("Free" in s or "free" in s):
            return 0.0, "USMCA preferential: Free"
        if country == "MX" and ("MX" in s) and ("Free" in s or "free" in s):
            return 0.0, "USMCA preferential: Free"
        if country in FTA_PARTNERS and country in s and ("Free" in s or "free" in s):
            return 0.0, "FTA preferential: Free"

    if country in USMCA_COUNTRIES:
        return 0.0, "USMCA qualifying (assumed)"
    if country in FTA_PARTNERS:
        return mfn_rate * 0.5, "FTA reduced (estimated)"

    return mfn_rate, ""


# ─────────────────────────────────────────────
# COUNTRY HELPERS
# ─────────────────────────────────────────────

COUNTRY_NAME_MAP = {
    "china": "CN", "prc": "CN",
    "united states": "US", "usa": "US", "us": "US",
    "canada": "CA", "mexico": "MX",
    "japan": "JP", "south korea": "KR", "korea": "KR",
    "germany": "DE", "uk": "GB", "united kingdom": "GB",
    "france": "FR", "india": "IN", "vietnam": "VN",
    "taiwan": "TW", "brazil": "BR", "australia": "AU",
    "italy": "IT", "spain": "ES", "indonesia": "ID",
    "thailand": "TH", "malaysia": "MY", "bangladesh": "BD",
    "cambodia": "KH", "philippines": "PH", "turkey": "TR",
}

COUNTRY_DISPLAY = {
    "CN": "China", "US": "United States", "CA": "Canada", "MX": "Mexico",
    "JP": "Japan", "KR": "South Korea", "DE": "Germany", "GB": "United Kingdom",
    "FR": "France", "IN": "India", "VN": "Vietnam", "TW": "Taiwan",
    "BR": "Brazil", "AU": "Australia", "BD": "Bangladesh", "ID": "Indonesia",
    "TH": "Thailand", "MY": "Malaysia", "KH": "Cambodia", "PH": "Philippines",
}


def normalize_country(country_input: str) -> str:
    s = country_input.strip().lower()
    if len(s) == 2 and s.upper() in COUNTRY_DISPLAY:
        return s.upper()
    return COUNTRY_NAME_MAP.get(s, s.upper()[:2])


# ─────────────────────────────────────────────
# RESULT DATACLASS
# ─────────────────────────────────────────────

@dataclass
class TariffResult:
    hts_code: str
    country: str
    country_name: str
    category: str
    category_label: str
    product_description: str

    mfn_base_rate: float
    fta_adjusted_rate: float
    section_301_rate: float
    section_232_rate: float
    ieepa_fentanyl_rate: float
    section_122_rate: float

    total_rate: float
    breakdown: list = field(default_factory=list)
    raw_rate_string: str = ""

    @property
    def total_pct(self) -> str:
        return f"{self.total_rate:.1%}"

    def tariff_on_price(self, price: float) -> float:
        return round(price * self.total_rate, 2)

    def to_dict(self) -> dict:
        return {
            "hts_code": self.hts_code,
            "country": self.country,
            "country_name": self.country_name,
            "category": self.category,
            "category_label": self.category_label,
            "product_description": self.product_description,
            "mfn_base_rate": self.mfn_base_rate,
            "fta_adjusted_rate": self.fta_adjusted_rate,
            "section_301_rate": self.section_301_rate,
            "section_232_rate": self.section_232_rate,
            "ieepa_fentanyl_rate": self.ieepa_fentanyl_rate,
            "section_122_rate": self.section_122_rate,
            "total_rate": self.total_rate,
            "total_pct": self.total_pct,
            "breakdown": self.breakdown,
            "raw_rate_string": self.raw_rate_string,
        }


# ─────────────────────────────────────────────
# MAIN LOOKUP
# ─────────────────────────────────────────────

def lookup_tariff(hts_code: str, country_of_origin: str,
                  csv_path: str = None) -> TariffResult:
    df = load_hts_csv(csv_path)
    country_iso = normalize_country(country_of_origin)
    country_name = COUNTRY_DISPLAY.get(country_iso, country_of_origin)
    category = get_category(hts_code)
    category_label = CATEGORY_LABELS.get(category, "Other Goods")

    # 1. Find in CSV
    entry = find_hts_entry(hts_code, df)

    if entry is not None:
        description = str(entry.get("Description", "")).strip()
        raw_rate_str = str(entry.get("General Rate of Duty", "")).strip()
        special_rate_str = str(entry.get("Special Rate of Duty", ""))
        mfn_rate = parse_rate(raw_rate_str)
    else:
        description = "Product not found in HTS schedule"
        raw_rate_str = "N/A"
        special_rate_str = ""
        mfn_rate = 0.0

    # 2. FTA adjustment
    fta_rate, fta_note = adjust_mfn_for_fta(country_iso, mfn_rate, special_rate_str)

    # 3-6. Surcharges
    s301 = get_section_301_rate(hts_code, country_iso)
    s232 = get_section_232_rate(hts_code)
    ieepa = get_ieepa_fentanyl_rate(country_iso)
    s122 = SECTION_122_RATE if country_iso != "US" else 0.0

    total = fta_rate + s301 + s232 + ieepa + s122

    # Breakdown
    breakdown = []
    if fta_rate == 0 and mfn_rate == 0:
        breakdown.append(f"MFN base rate: Free ({raw_rate_str})")
    elif fta_note:
        breakdown.append(f"MFN base rate: {mfn_rate:.1%} → {fta_rate:.1%} ({fta_note})")
    else:
        breakdown.append(f"MFN base rate: {fta_rate:.1%} ({raw_rate_str})")

    if s301 > 0:
        breakdown.append(f"Section 301 (China trade war): +{s301:.1%}")
    if s232 > 0:
        breakdown.append(f"Section 232 (national security): +{s232:.1%}")
    if ieepa > 0:
        breakdown.append(f"IEEPA fentanyl surcharge (China): +{ieepa:.1%}")
    if s122 > 0:
        breakdown.append(f"Section 122 blanket tariff (NEW Feb 20): +{s122:.1%}")
    breakdown.append(f"═══ TOTAL EFFECTIVE RATE: {total:.1%} ═══")

    return TariffResult(
        hts_code=hts_code, country=country_iso, country_name=country_name,
        category=category, category_label=category_label,
        product_description=description, mfn_base_rate=mfn_rate,
        fta_adjusted_rate=fta_rate, section_301_rate=s301,
        section_232_rate=s232, ieepa_fentanyl_rate=ieepa,
        section_122_rate=s122, total_rate=total,
        breakdown=breakdown, raw_rate_string=raw_rate_str,
    )


# ─────────────────────────────────────────────
# CLI DEMO
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    csv_path = sys.argv[1] if len(sys.argv) > 1 else None

    print("=" * 60)
    print("  TariffShield Tariff Engine — CSV-Backed (Full Coverage)")
    print("  Post-SCOTUS ruling, Feb 20, 2026")
    print("=" * 60)

    scenarios = [
        ("Samsung 55\" TV",             "8528.72.64",  "China",      499.99),
        ("Sony Headphones WH-1000XM5",  "8518.30.20",  "Malaysia",   348.00),
        ("Nike Running Shoes",          "6402.99.31",  "Vietnam",    129.99),
        ("IKEA Desk Chair",             "9401.30.80",  "China",      249.00),
        ("Honda Civic (imported)",       "8703.23.00",  "Japan",    28500.00),
        ("Stainless Steel Pan Set",     "7323.93.00",  "China",       89.99),
        ("LEGO Set",                    "9503.00.00",  "China",       59.99),
        ("Cotton T-Shirt",              "6109.10.00",  "Bangladesh",  14.99),
        ("MacBook Pro",                 "8471.30.01",  "China",     1999.00),
        ("Steel Bolts",                 "7318.15.20",  "Canada",      24.99),
    ]

    for name, hts, country, price in scenarios:
        result = lookup_tariff(hts, country, csv_path)
        tariff_cost = result.tariff_on_price(price)

        print(f"\n{'─' * 58}")
        print(f"  {name}")
        print(f"  HTS: {hts} | Origin: {result.country_name}")
        print(f"  Category: {result.category_label}")
        print(f"  CSV Description: {result.product_description[:65]}")
        print(f"  Retail Price: ${price:,.2f}")
        print(f"{'─' * 58}")
        for line in result.breakdown:
            print(f"  {line}")
        print(f"  💰 Estimated tariff cost: ${tariff_cost:,.2f}")

"""
TariffShield — AI Product Classifier
=====================================
Uses Claude (via Anthropic SDK) to classify products:
  Product name/URL → (HTS code, country of origin, product category)

This is the "brain" of TariffShield and the core integration
for the Claude Agent SDK sponsor prize.
"""

import json
import os
import re
from dotenv import load_dotenv

load_dotenv()

# You'll need: pip install anthropic
# Set ANTHROPIC_API_KEY env var or pass directly

CLASSIFIER_SYSTEM_PROMPT = """You are a US trade compliance expert embedded in a consumer app called TariffShield.

Given a product name, description, or URL, you must determine:
1. The most likely HTS (Harmonized Tariff Schedule) code (10-digit format like 8528.72.64)
2. The most likely country of origin/manufacture
3. A brief product description
4. The product category

IMPORTANT RULES:
- For HTS codes, be specific. Use your knowledge of the HTS 2026 schedule.
- For country of origin, identify where the product is MANUFACTURED (not the brand's HQ).
  Example: Apple iPhone → manufactured in China (Foxconn). Nike shoes → Vietnam or China.
- If uncertain about exact HTS code, give the best 6-digit heading and note uncertainty.
- For country, if multiple manufacturing locations exist, pick the most common one.

COMMON MAPPINGS (use as reference):
- Smartphones/tablets: 8517.13.00, usually China
- Laptops: 8471.30.01, usually China
- TVs/monitors: 8528.72.64, usually China/Mexico
- Headphones: 8518.30.20, varies (China/Malaysia/Vietnam)
- Furniture (wood): 9403.40-60, often China/Vietnam
- Office chairs: 9401.30.80, often China
- Cotton t-shirts: 6109.10.00, Bangladesh/Vietnam/China
- Athletic shoes: 6402.99.31, Vietnam/China/Indonesia
- Toys general: 9503.00.00, usually China
- Steel cookware: 7323.93.00, usually China
- Video game consoles: 9504.50.00, usually China
- Passenger vehicles: 8703.23.00, varies by brand

You MUST respond with valid JSON only. No markdown, no explanation, no preamble.

Respond with this exact JSON structure:
{
  "product_name": "Short product name",
  "hts_code": "XXXX.XX.XX",
  "country_of_origin": "XX",
  "country_name": "Country Name",
  "description": "Brief product description",
  "category": "one of: electronics, furniture, clothing, auto_parts, steel_aluminum, toys, other",
  "confidence": "high/medium/low",
  "notes": "Any relevant notes about classification"
}"""


async def classify_product_async(product_input: str, api_key: str = None) -> dict:
    """
    Classify a product using Claude API (async version).
    Returns parsed dict with HTS code, country, category.
    """
    try:
        from anthropic import AsyncAnthropic
    except ImportError:
        return _fallback_classify(product_input)

    key = api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return _fallback_classify(product_input)

    client = AsyncAnthropic(api_key=key)

    message = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=500,
        system=CLASSIFIER_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Classify this product for tariff analysis:\n\n{product_input}"
            }
        ]
    )

    # Parse JSON response
    response_text = message.content[0].text.strip()
    # Remove any markdown code fences if present
    response_text = re.sub(r'^```json\s*', '', response_text)
    response_text = re.sub(r'\s*```$', '', response_text)

    try:
        result = json.loads(response_text)
        return result
    except json.JSONDecodeError:
        return _fallback_classify(product_input)


def classify_product_sync(product_input: str, api_key: str = None) -> dict:
    """
    Classify a product using Claude API (sync version).
    """
    try:
        from anthropic import Anthropic
    except ImportError:
        return _fallback_classify(product_input)

    key = api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return _fallback_classify(product_input)

    client = Anthropic(api_key=key)

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=500,
        system=CLASSIFIER_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Classify this product for tariff analysis:\n\n{product_input}"
            }
        ]
    )

    response_text = message.content[0].text.strip()
    response_text = re.sub(r'^```json\s*', '', response_text)
    response_text = re.sub(r'\s*```$', '', response_text)

    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        return _fallback_classify(product_input)


# ─────────────────────────────────────────────
# KEYWORD-BASED FALLBACK CLASSIFIER
# Used when Claude API is not available
# ─────────────────────────────────────────────

KEYWORD_RULES = [
    # (keywords, hts_code, country, category, description)
    # NOTE: Order matters! More specific rules FIRST to avoid false matches.
    # Steel/aluminum before clothing (prevents "stainless steel" → "t-shirt")
    (["steel pan", "stainless steel", "cookware", "pot", "frying pan",
      "pressure cooker", "instant pot", "wok", "skillet"],
     "7323.93.00", "CN", "steel_aluminum", "Steel cookware"),
    (["aluminum foil", "foil"],
     "7607.11.90", "CN", "steel_aluminum", "Aluminum foil"),
    (["bolt", "screw", "nut", "hardware", "fastener"],
     "7318.15.20", "CN", "steel_aluminum", "Steel fasteners"),

    (["iphone", "ipad", "smartphone", "phone", "galaxy", "pixel"],
     "8517.13.00", "CN", "electronics", "Smartphone/tablet"),
    (["macbook", "laptop", "thinkpad", "chromebook", "notebook"],
     "8471.30.01", "CN", "electronics", "Laptop computer"),
    (["desktop", "imac", "pc tower"],
     "8471.41.01", "CN", "electronics", "Desktop computer"),
    (["tv", "television", "monitor", "display", "oled", "qled"],
     "8528.72.64", "CN", "electronics", "Television/monitor"),
    (["headphone", "earphone", "earbud", "airpod", "beats"],
     "8518.30.20", "CN", "electronics", "Headphones/earphones"),
    (["printer", "scanner"],
     "8443.32.10", "CN", "electronics", "Printer"),
    (["camera", "dslr", "mirrorless"],
     "8525.80.30", "CN", "electronics", "Digital camera"),
    (["charger", "power adapter", "usb-c"],
     "8504.40.95", "CN", "electronics", "Power adapter/charger"),
    (["battery", "lithium", "power bank"],
     "8507.60.00", "CN", "electronics", "Battery"),

    # Furniture
    (["desk chair", "office chair", "swivel chair"],
     "9401.30.80", "CN", "furniture", "Office/desk chair"),
    (["couch", "sofa", "loveseat", "sectional"],
     "9401.61.40", "CN", "furniture", "Upholstered seating"),
    (["desk", "table", "kitchen table", "dining table"],
     "9403.40.90", "CN", "furniture", "Wood furniture"),
    (["bed frame", "bookshelf", "dresser", "nightstand", "cabinet"],
     "9403.60.80", "CN", "furniture", "Wood furniture"),
    (["mattress", "memory foam"],
     "9404.29.90", "CN", "furniture", "Mattress"),
    (["lamp", "light fixture", "chandelier"],
     "9405.10.60", "CN", "furniture", "Lighting fixture"),

    # Clothing
    (["t-shirt", "tee", "cotton shirt"],
     "6109.10.00", "BD", "clothing", "Cotton t-shirt"),
    (["sweater", "pullover", "hoodie", "sweatshirt"],
     "6110.20.20", "VN", "clothing", "Sweater/pullover"),
    (["jeans", "pants", "trousers", "chinos"],
     "6203.42.40", "BD", "clothing", "Trousers/pants"),
    (["jacket", "coat", "parka", "down jacket"],
     "6201.13.40", "CN", "clothing", "Jacket/coat"),
    (["running shoe", "sneaker", "athletic shoe", "nike", "adidas", "new balance"],
     "6402.99.31", "VN", "clothing", "Athletic footwear"),
    (["leather shoe", "boot", "dress shoe", "loafer"],
     "6403.99.60", "CN", "clothing", "Leather footwear"),
    (["bed sheet", "pillow case", "linen", "duvet"],
     "6302.31.90", "CN", "clothing", "Bed linens"),

    # Auto
    (["car", "sedan", "suv", "vehicle", "honda", "toyota", "ford", "bmw", "tesla"],
     "8703.23.00", "JP", "auto_parts", "Passenger vehicle"),
    (["brake pad", "brake", "rotor"],
     "8708.30.50", "CN", "auto_parts", "Brake parts"),
    (["car part", "auto part", "fender", "bumper"],
     "8708.29.50", "CN", "auto_parts", "Vehicle body parts"),
    (["tire", "tyre"],
     "4011.10.10", "CN", "auto_parts", "Vehicle tire"),

    # Toys
    (["lego", "toy", "action figure", "doll", "plush"],
     "9503.00.00", "CN", "toys", "Toys"),
    (["playstation", "xbox", "nintendo", "switch", "game console"],
     "9504.50.00", "CN", "toys", "Video game console"),
    (["board game", "puzzle", "card game"],
     "9504.90.60", "CN", "toys", "Board game/puzzle"),
    (["exercise", "treadmill", "dumbbell", "weight", "yoga mat"],
     "9506.91.00", "CN", "toys", "Exercise equipment"),
]


def _fallback_classify(product_input: str) -> dict:
    """
    Keyword-based classification when Claude API isn't available.
    """
    text = product_input.lower()

    for keywords, hts, country, category, desc in KEYWORD_RULES:
        if any(kw in text for kw in keywords):
            return {
                "product_name": product_input[:50],
                "hts_code": hts,
                "country_of_origin": country,
                "country_name": COUNTRY_NAMES.get(country, country),
                "description": desc,
                "category": category,
                "confidence": "medium",
                "notes": "Classified via keyword matching (Claude API unavailable)",
            }

    return {
        "product_name": product_input[:50],
        "hts_code": "9999.99.99",
        "country_of_origin": "CN",
        "country_name": "China",
        "description": "Unclassified product",
        "category": "other",
        "confidence": "low",
        "notes": "Could not classify — defaulting to general goods from China",
    }


COUNTRY_NAMES = {
    "CN": "China", "US": "United States", "JP": "Japan", "KR": "South Korea",
    "DE": "Germany", "GB": "United Kingdom", "VN": "Vietnam", "BD": "Bangladesh",
    "IN": "India", "MX": "Mexico", "CA": "Canada", "TW": "Taiwan",
    "TH": "Thailand", "MY": "Malaysia", "ID": "Indonesia", "KH": "Cambodia",
}


# ─────────────────────────────────────────────
# COMBINED PIPELINE: Product Input → Tariff Result
# ─────────────────────────────────────────────

def analyze_product(product_input: str, price: float = None, api_key: str = None) -> dict:
    """
    Full pipeline: product name/URL → classification → tariff lookup.
    Returns complete analysis dict.
    """
    from tariff_engine import lookup_tariff

    # Step 1: Classify
    classification = classify_product_sync(product_input, api_key)

    # Step 2: Tariff lookup
    tariff = lookup_tariff(
        classification["hts_code"],
        classification["country_of_origin"]
    )

    # Step 3: Combine results
    result = {
        "input": product_input,
        "classification": classification,
        "tariff": tariff.to_dict(),
    }

    if price is not None:
        tariff_cost = tariff.tariff_on_price(price)
        result["price_analysis"] = {
            "retail_price": price,
            "estimated_tariff_cost": round(tariff_cost, 2),
            "price_without_tariff": round(price - tariff_cost, 2),
            "tariff_as_pct_of_price": f"{(tariff_cost/price)*100:.1f}%",
        }

    return result


# ─────────────────────────────────────────────
# TEST
# ─────────────────────────────────────────────

if __name__ == "__main__":
    # Test fallback classifier (no API key needed)
    test_inputs = [
        "Samsung 65 inch OLED TV",
        "Nike Air Max 90 running shoes",
        "IKEA MARKUS office chair",
        "Apple MacBook Pro 16 inch",
        "Instant Pot stainless steel pressure cooker",
        "LEGO Star Wars set 75375",
        "Levi's 501 jeans",
        "Honda Civic 2026",
    ]

    print("=" * 55)
    print("  TariffShield Product Classifier — Fallback Mode")
    print("=" * 55)

    for inp in test_inputs:
        result = _fallback_classify(inp)
        print(f"\n  Input: {inp}")
        print(f"  → HTS: {result['hts_code']} | "
              f"Origin: {result['country_name']} | "
              f"Category: {result['category']}")
        print(f"  → Description: {result['description']} "
              f"(confidence: {result['confidence']})")

"""
Tariffind — AI Price History Estimator
==========================================
Uses Claude to generate estimated price history for consumer products,
annotated with tariff policy events that caused price changes.

Not real historical data — clearly labeled as AI estimates.
For the hackathon demo, this tells a compelling story about WHY prices changed.
"""

import os
import json
import anthropic
from typing import Optional


PRICE_HISTORY_PROMPT = """You are a consumer price analyst for a tariff transparency app called Tariffind.

Given a product, its current retail price, and its country of origin, generate an estimated price history timeline showing how the price likely changed due to US tariff policies.

IMPORTANT CONTEXT (as of February 2026):
- Section 301 tariffs on China: began 2018-2019, escalated through 2024-2025
- Section 232 tariffs on steel/aluminum: 25% since March 2018, expanded to autos April 2025
- IEEPA fentanyl tariffs on China: 20% added February 2025
- IEEPA "Liberation Day" tariffs: April 2025 (STRUCK DOWN by SCOTUS Feb 20, 2026)
- Section 122 blanket tariff: 10% on all imports, signed Feb 20, 2026 (same day as SCOTUS ruling)

Return ONLY valid JSON with this structure:
{
  "product": "product name",
  "currency": "USD",
  "current_price": current price as number,
  "estimated_pre_tariff_price": estimated price before any tariff impact as number,
  "total_tariff_markup": estimated dollar amount of tariff-driven price increase,
  "timeline": [
    {
      "date": "YYYY-MM",
      "estimated_price": price as number,
      "event": "brief description of what happened",
      "tariff_impact": "which tariff policy caused this change"
    }
  ],
  "confidence": "low|medium|high",
  "disclaimer": "Prices are AI-estimated based on market trends and tariff policy. Not actual historical data."
}

Include 6-10 timeline entries spanning from early 2024 to February 2026.
Be realistic — not every tariff causes an immediate full pass-through to consumers.
Manufacturers absorb some costs, and prices don't always move immediately."""


def estimate_price_history(product_name: str, current_price: float,
                           country_of_origin: str = "China",
                           category: str = "",
                           api_key: str = None) -> dict:
    """
    Use Claude to generate estimated price history with tariff annotations.
    Returns structured timeline data for the frontend to render as a chart.
    """
    key = api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return _fallback_price_history(product_name, current_price, country_of_origin)

    client = anthropic.Anthropic(api_key=key)

    user_msg = (
        f"Product: {product_name}\n"
        f"Current retail price: ${current_price:.2f}\n"
        f"Country of origin: {country_of_origin}\n"
        f"Category: {category}\n\n"
        f"Generate the estimated price history timeline as JSON."
    )

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1200,
            system=PRICE_HISTORY_PROMPT,
            messages=[{"role": "user", "content": user_msg}],
        )

        text = response.content[0].text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text.rsplit("```", 1)[0]
            text = text.strip()

        data = json.loads(text)
        return data

    except json.JSONDecodeError as e:
        print(f"[Tariffind] Failed to parse Claude price history response: {e}")
        return _fallback_price_history(product_name, current_price, country_of_origin)
    except Exception as e:
        print(f"[Tariffind] Claude price history failed: {e}")
        return _fallback_price_history(product_name, current_price, country_of_origin)


def _fallback_price_history(product_name: str, current_price: float,
                            country: str = "China") -> dict:
    """
    Fallback: generate a generic but realistic price history
    when Claude API is unavailable.
    """
    is_china = country.lower() in ["china", "cn"]

    # Estimate pre-tariff price (remove ~30-40% tariff markup for China, ~10% for others)
    if is_china:
        pre_tariff = round(current_price / 1.35, 2)
        markup = round(current_price - pre_tariff, 2)
    else:
        pre_tariff = round(current_price / 1.10, 2)
        markup = round(current_price - pre_tariff, 2)

    # Build a generic timeline
    timeline = [
        {
            "date": "2024-01",
            "estimated_price": pre_tariff,
            "event": "Baseline price before major tariff escalation",
            "tariff_impact": "Existing tariffs already partially priced in"
        },
        {
            "date": "2024-06",
            "estimated_price": round(pre_tariff * 1.03, 2),
            "event": "Gradual price increases as retailers adjust",
            "tariff_impact": "Section 301 tariffs on China (ongoing)"
        },
        {
            "date": "2024-11",
            "estimated_price": round(pre_tariff * 1.05, 2),
            "event": "Post-election tariff escalation expectations",
            "tariff_impact": "Market anticipating new tariff policies"
        },
        {
            "date": "2025-02",
            "estimated_price": round(pre_tariff * 1.12, 2) if is_china else round(pre_tariff * 1.03, 2),
            "event": "IEEPA fentanyl tariffs take effect on China",
            "tariff_impact": "IEEPA fentanyl surcharge (+20% on China)" if is_china else "Minimal direct impact"
        },
        {
            "date": "2025-04",
            "estimated_price": round(pre_tariff * 1.25, 2) if is_china else round(pre_tariff * 1.08, 2),
            "event": "\"Liberation Day\" tariffs announced",
            "tariff_impact": "Broad IEEPA tariffs (later struck down by SCOTUS)"
        },
        {
            "date": "2025-08",
            "estimated_price": round(pre_tariff * 1.30, 2) if is_china else round(pre_tariff * 1.10, 2),
            "event": "Full tariff pass-through as retailer margins compress",
            "tariff_impact": "Cumulative effect of multiple tariff layers"
        },
        {
            "date": "2025-12",
            "estimated_price": round(pre_tariff * 1.28, 2) if is_china else round(pre_tariff * 1.08, 2),
            "event": "Holiday discounting partially offsets tariffs",
            "tariff_impact": "Retailers absorb some costs for holiday season"
        },
        {
            "date": "2026-02",
            "estimated_price": current_price,
            "event": "SCOTUS strikes down IEEPA tariffs; Section 122 blanket tariff signed",
            "tariff_impact": "Net effect: some tariffs removed, new 10% blanket added"
        },
    ]

    return {
        "product": product_name,
        "currency": "USD",
        "current_price": current_price,
        "estimated_pre_tariff_price": pre_tariff,
        "total_tariff_markup": markup,
        "timeline": timeline,
        "confidence": "low",
        "disclaimer": "Prices are AI-estimated based on general market trends and tariff policy. Not actual historical data.",
        "source": "fallback_estimate"
    }


# ─────────────────────────────────────────────
# CLI TEST
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    product = sys.argv[1] if len(sys.argv) > 1 else "Samsung 55 inch 4K TV"
    price = float(sys.argv[2]) if len(sys.argv) > 2 else 499.99
    country = sys.argv[3] if len(sys.argv) > 3 else "China"

    print(f"Estimating price history for: {product}")
    print(f"Current price: ${price:.2f} | Origin: {country}")
    print("=" * 55)

    result = estimate_price_history(product, price, country)

    print(f"\nPre-tariff estimate: ${result['estimated_pre_tariff_price']}")
    print(f"Tariff markup: ${result['total_tariff_markup']}")
    print(f"Confidence: {result['confidence']}")
    print(f"\nTimeline:")
    for entry in result["timeline"]:
        print(f"  {entry['date']}: ${entry['estimated_price']:.2f}")
        print(f"    {entry['event']}")
        print(f"    → {entry['tariff_impact']}")
    print(f"\n⚠️  {result['disclaimer']}")
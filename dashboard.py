"""
TariffShield — Tariff Tax Dashboard
=====================================
The "Spotify Wrapped" for tariffs.
User submits purchases → calculates total tariff tax paid,
breakdown by category, comparison to national average, shareable card.
"""

from typing import Optional


# National average tariff burden per household (Tax Foundation 2026 estimate)
NATIONAL_AVG_ANNUAL = 1300

# Consumer pass-through rates by category
# What % of the import tariff actually gets passed to retail prices
# Sources: St. Louis Fed, Yale Budget Lab, Harvard Business School Pricing Lab
PASSTHROUGH_RATES = {
    "electronics":    0.70,    # ~70% — manufacturers absorb some margin
    "furniture":      0.75,
    "clothing":       0.85,    # High pass-through — thin margins
    "auto_parts":     0.60,    # Auto industry absorbs more
    "steel_aluminum": 0.65,
    "toys":           0.80,
    "other":          0.72,    # Weighted average across categories
}


def get_passthrough_rate(category: str) -> float:
    """Get the consumer pass-through rate for a product category."""
    return PASSTHROUGH_RATES.get(category, 0.72)


def calculate_consumer_tariff(raw_tariff_cost: float, category: str) -> float:
    """
    Adjust raw import tariff to estimated consumer impact.
    Not all tariff costs are passed to consumers — retailers/manufacturers absorb some.
    """
    passthrough = get_passthrough_rate(category)
    return round(raw_tariff_cost * passthrough, 2)


def build_price_impact(price: float, raw_tariff_cost: float, category: str,
                        category_label: str) -> dict:
    """Build a detailed price impact dict with pass-through adjustment."""
    passthrough = get_passthrough_rate(category)
    consumer_cost = round(raw_tariff_cost * passthrough, 2)
    pre_tariff_price = round(price - consumer_cost, 2)

    return {
        "retail_price": price,
        "import_tariff_total": round(raw_tariff_cost, 2),
        "estimated_tariff_you_pay": consumer_cost,
        "estimated_pre_tariff_price": pre_tariff_price,
        "tariff_share_of_price": f"{(consumer_cost / price) * 100:.1f}%",
        "passthrough_rate": passthrough,
        "passthrough_note": (
            f"~{passthrough:.0%} of tariffs are typically passed to consumers "
            f"for {category_label.lower()}"
        ),
    }


def generate_dashboard(items: list[dict]) -> dict:
    """
    Generate the full Tariff Tax Dashboard from analyzed items.
    
    Each item should have:
      - product: str
      - price: float
      - tariff_you_pay: float
      - tariff_rate: str
      - country: str
      - category: str
    """
    total_spent = sum(item["price"] for item in items)
    total_tariff = sum(item["tariff_you_pay"] for item in items)

    # Category breakdown
    category_totals = {}
    for item in items:
        cat = item["category"]
        category_totals[cat] = category_totals.get(cat, 0) + item["tariff_you_pay"]

    category_breakdown = sorted(
        [{"category": k, "tariff_paid": round(v, 2)} for k, v in category_totals.items()],
        key=lambda x: x["tariff_paid"],
        reverse=True,
    )

    # Annualize estimate (assume purchases represent ~1 month)
    estimated_annual = round(total_tariff * 12, 2)

    return {
        "summary": {
            "total_spent": round(total_spent, 2),
            "total_tariff_paid": round(total_tariff, 2),
            "tariff_as_pct_of_spending": (
                f"{(total_tariff / total_spent * 100):.1f}%" if total_spent > 0 else "0%"
            ),
            "estimated_annual_tariff": estimated_annual,
            "national_average_annual": NATIONAL_AVG_ANNUAL,
            "vs_national_avg": (
                f"{'above' if estimated_annual > NATIONAL_AVG_ANNUAL else 'below'} "
                f"the ${NATIONAL_AVG_ANNUAL:,} national average"
            ),
        },
        "category_breakdown": category_breakdown,
        "items": items,
        "shareable_card": {
            "headline": f"I've paid ~${round(total_tariff, 2)} in hidden tariffs",
            "subtext": (
                f"That's {(total_tariff / total_spent * 100):.1f}% of my spending "
                f"going to tariffs" if total_spent > 0 else ""
            ),
            "cta": "See your tariff tax → TariffShield.app",
        },
    }


# ─────────────────────────────────────────────
# CLI TEST
# ─────────────────────────────────────────────

if __name__ == "__main__":
    # Mock some analyzed items
    mock_items = [
        {
            "product": "Samsung 55\" TV",
            "price": 499.99,
            "tariff_you_pay": 144.28,
            "tariff_rate": "58.9%",
            "country": "China",
            "category": "Electronics & Electrical Equipment",
        },
        {
            "product": "Nike Running Shoes",
            "price": 129.99,
            "tariff_you_pay": 14.87,
            "tariff_rate": "16.0%",
            "country": "Vietnam",
            "category": "Other Goods",
        },
        {
            "product": "IKEA Desk Chair",
            "price": 249.00,
            "tariff_you_pay": 102.71,
            "tariff_rate": "55.0%",
            "country": "China",
            "category": "Furniture & Home Furnishings",
        },
    ]

    result = generate_dashboard(mock_items)

    print("=" * 55)
    print("  YOUR TARIFF TAX REPORT")
    print("=" * 55)
    s = result["summary"]
    print(f"\n  Total spent:          ${s['total_spent']:,.2f}")
    print(f"  Hidden tariff tax:    ${s['total_tariff_paid']:,.2f}")
    print(f"  Tariff % of spending: {s['tariff_as_pct_of_spending']}")
    print(f"  Estimated annual:     ${s['estimated_annual_tariff']:,.2f}")
    print(f"  National average:     ${s['national_average_annual']:,}/year")
    print(f"  You're {s['vs_national_avg']}")

    print(f"\n  Category breakdown:")
    for cat in result["category_breakdown"]:
        print(f"    {cat['category']}: ${cat['tariff_paid']:.2f}")

    print(f"\n  📱 {result['shareable_card']['headline']}")
    print(f"     {result['shareable_card']['subtext']}")
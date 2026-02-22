"""
TariffShield — Shopping Cart Analyzer (Vision)
===============================================
Upload a screenshot of your shopping cart (Amazon, Walmart, Target, etc.)
→ Claude Vision extracts every item + price
→ Each item gets classified + tariff breakdown
→ Returns total tariff exposure across the entire cart

This is the "wow factor" feature: paste a screenshot, see the hidden tax.
"""

import os
import json
import re
import base64
from typing import Optional

from dotenv import load_dotenv

load_dotenv()


# ─────────────────────────────────────────────
# CART EXTRACTION VIA CLAUDE VISION
# ─────────────────────────────────────────────

CART_EXTRACTION_PROMPT = """You are analyzing a screenshot of an online shopping cart (Amazon, Walmart, Target, Best Buy, etc.).

Extract EVERY item visible in the cart. For each item, determine:
1. product_name — the product title (be specific enough for tariff classification)
2. price — the unit price as a number (NOT the total if qty > 1)
3. quantity — how many of this item (default 1 if not shown)

RULES:
- Extract ALL items you can see, even partially visible ones
- For price, extract the UNIT price, not line totals
- If you see a subtotal/total at the bottom, include it separately as cart_subtotal
- Ignore shipping costs, tax lines, promo discounts — just the products
- If a price is unclear, estimate based on the product type
- Be specific with product names: "Apple AirPods Pro 2nd Gen" not just "headphones"

Return ONLY valid JSON with this exact structure:
{
  "store": "Amazon|Walmart|Target|BestBuy|Unknown",
  "items": [
    {
      "product_name": "Full product name",
      "price": 29.99,
      "quantity": 1
    }
  ],
  "cart_subtotal": 149.97,
  "items_detected": 3,
  "confidence": "high|medium|low",
  "notes": "Any issues with extraction"
}"""


def extract_cart_from_image(
    image_data: str,
    media_type: str = "image/png",
    api_key: str = None,
) -> dict:
    """
    Use Claude Vision to extract shopping cart items from a screenshot.

    Args:
        image_data: base64-encoded image string
        media_type: MIME type (image/png, image/jpeg, image/webp, image/gif)
        api_key: Anthropic API key (or uses env var)

    Returns:
        Dict with store, items[], cart_subtotal, etc.
    """
    key = api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise ValueError("ANTHROPIC_API_KEY required for cart vision analysis")

    try:
        from anthropic import Anthropic
    except ImportError:
        raise ImportError("anthropic package required: pip install anthropic")

    client = Anthropic(api_key=key)

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        system=CART_EXTRACTION_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_data,
                        },
                    },
                    {
                        "type": "text",
                        "text": "Extract all items from this shopping cart screenshot.",
                    },
                ],
            }
        ],
    )

    response_text = message.content[0].text.strip()
    # Strip markdown code fences
    response_text = re.sub(r"^```json\s*", "", response_text)
    response_text = re.sub(r"\s*```$", "", response_text)

    try:
        return json.loads(response_text)
    except json.JSONDecodeError as e:
        print(f"[TariffShield] Failed to parse cart extraction: {e}")
        print(f"[TariffShield] Raw response: {response_text[:500]}")
        return {
            "store": "Unknown",
            "items": [],
            "cart_subtotal": 0,
            "items_detected": 0,
            "confidence": "low",
            "notes": f"Failed to parse Claude response: {str(e)}",
        }


# ─────────────────────────────────────────────
# FULL CART TARIFF ANALYSIS
# ─────────────────────────────────────────────

def analyze_cart(
    image_data: str,
    media_type: str = "image/png",
    classify_fn=None,
    use_ai: bool = True,
    api_key: str = None,
    max_swap_suggestions: int = 3,
    alts_per_swap: int = 2,
) -> dict:
    """
    Full pipeline: cart screenshot → extract items → classify each → tariff breakdown → aggregate → swap suggestions.

    Args:
        image_data: base64-encoded cart screenshot
        media_type: image MIME type
        classify_fn: callable(product_name, use_ai) → classification dict
        use_ai: use Claude for product classification (vs keyword fallback)
        api_key: Anthropic API key
        max_swap_suggestions: how many high-tariff items to find swaps for (default 3)
        alts_per_swap: how many alternative suggestions per item (default 2)

    Returns:
        Complete cart tariff analysis with per-item data, aggregate summary, and swap suggestions.
    """
    from tariff_engine import lookup_tariff
    from dashboard import get_passthrough_rate

    # Step 1: Extract items from screenshot
    cart_data = extract_cart_from_image(image_data, media_type, api_key)

    items = cart_data.get("items", [])
    if not items:
        return {
            "store": cart_data.get("store", "Unknown"),
            "error": "No items could be extracted from the image",
            "extraction": cart_data,
            "analyzed_items": [],
            "summary": _empty_summary(),
        }

    # Step 2: Classify + tariff each item
    analyzed_items = []
    total_cart_price = 0.0
    total_tariff_cost = 0.0
    total_tariff_you_pay = 0.0
    category_breakdown = {}
    country_breakdown = {}

    for item in items:
        product_name = item.get("product_name", "Unknown")
        unit_price = item.get("price", 0)
        quantity = item.get("quantity", 1)

        if not unit_price or unit_price <= 0:
            analyzed_items.append({
                "product_name": product_name,
                "unit_price": unit_price,
                "quantity": quantity,
                "line_total": 0,
                "error": "No price available",
            })
            continue

        line_total = round(unit_price * quantity, 2)
        total_cart_price += line_total

        # Classify
        try:
            if classify_fn:
                classification = classify_fn(product_name, use_ai)
            else:
                from product_classifier import classify_product_sync, _fallback_classify
                classification = (
                    classify_product_sync(product_name)
                    if use_ai
                    else _fallback_classify(product_name)
                )
        except Exception as e:
            print(f"[TariffShield] Classification failed for '{product_name}': {e}")
            from product_classifier import _fallback_classify
            classification = _fallback_classify(product_name)

        if not classification or "hts_code" not in classification:
            analyzed_items.append({
                "product_name": product_name,
                "unit_price": unit_price,
                "quantity": quantity,
                "line_total": line_total,
                "error": "Could not classify product",
            })
            continue

        # Tariff lookup
        try:
            tariff_result = lookup_tariff(
                classification["hts_code"],
                classification.get("country_of_origin", "CN"),
            )
        except Exception as e:
            print(f"[TariffShield] Tariff lookup failed for '{product_name}': {e}")
            analyzed_items.append({
                "product_name": product_name,
                "unit_price": unit_price,
                "quantity": quantity,
                "line_total": line_total,
                "classification": classification,
                "error": f"Tariff lookup failed: {str(e)}",
            })
            continue

        # Calculate tariff cost for this line item
        raw_tariff_cost = tariff_result.tariff_on_price(line_total)
        passthrough_rate = get_passthrough_rate(tariff_result.category)
        tariff_you_pay = round(raw_tariff_cost * passthrough_rate, 2)

        total_tariff_cost += raw_tariff_cost
        total_tariff_you_pay += tariff_you_pay

        # Aggregate by category
        cat_label = tariff_result.category_label
        if cat_label not in category_breakdown:
            category_breakdown[cat_label] = {
                "items": 0,
                "spend": 0.0,
                "tariff_cost": 0.0,
            }
        category_breakdown[cat_label]["items"] += quantity
        category_breakdown[cat_label]["spend"] += line_total
        category_breakdown[cat_label]["tariff_cost"] += tariff_you_pay

        # Aggregate by country
        country_name = tariff_result.country_name
        if country_name not in country_breakdown:
            country_breakdown[country_name] = {
                "items": 0,
                "spend": 0.0,
                "tariff_cost": 0.0,
                "avg_tariff_rate": 0.0,
                "_rates": [],
            }
        country_breakdown[country_name]["items"] += quantity
        country_breakdown[country_name]["spend"] += line_total
        country_breakdown[country_name]["tariff_cost"] += tariff_you_pay
        country_breakdown[country_name]["_rates"].append(tariff_result.total_rate)

        # Per-item result
        analyzed_items.append({
            "product_name": product_name,
            "unit_price": unit_price,
            "quantity": quantity,
            "line_total": line_total,
            "hts_code": tariff_result.hts_code,
            "country_of_origin": country_name,
            "country_code": tariff_result.country,
            "category": cat_label,
            "tariff_rate": tariff_result.total_rate,
            "tariff_pct": tariff_result.total_pct,
            "raw_tariff_cost": raw_tariff_cost,
            "consumer_passthrough": passthrough_rate,
            "tariff_you_pay": tariff_you_pay,
            "price_without_tariff": round(line_total - tariff_you_pay, 2),
            "breakdown": tariff_result.breakdown,
        })

    # Finalize country averages
    for country in country_breakdown.values():
        rates = country.pop("_rates", [])
        country["avg_tariff_rate"] = (
            f"{(sum(rates) / len(rates)):.1%}" if rates else "0.0%"
        )
        country["spend"] = round(country["spend"], 2)
        country["tariff_cost"] = round(country["tariff_cost"], 2)

    # Finalize category totals
    for cat in category_breakdown.values():
        cat["spend"] = round(cat["spend"], 2)
        cat["tariff_cost"] = round(cat["tariff_cost"], 2)

    # Build summary
    total_cart_price = round(total_cart_price, 2)
    total_tariff_cost = round(total_tariff_cost, 2)
    total_tariff_you_pay = round(total_tariff_you_pay, 2)

    # Find the most expensive tariff item
    highest_tariff_item = None
    highest_rate = 0
    for item in analyzed_items:
        rate = item.get("tariff_rate", 0)
        if rate > highest_rate:
            highest_rate = rate
            highest_tariff_item = item.get("product_name")

    summary = {
        "store": cart_data.get("store", "Unknown"),
        "total_items": sum(
            item.get("quantity", 1)
            for item in analyzed_items
            if "error" not in item
        ),
        "total_cart_price": total_cart_price,
        "total_tariff_cost_raw": total_tariff_cost,
        "total_tariff_you_pay": total_tariff_you_pay,
        "tariff_as_pct_of_cart": (
            f"{(total_tariff_you_pay / total_cart_price * 100):.1f}%"
            if total_cart_price > 0
            else "0.0%"
        ),
        "price_without_tariffs": round(total_cart_price - total_tariff_you_pay, 2),
        "highest_tariff_item": highest_tariff_item,
        "highest_tariff_rate": f"{highest_rate:.1%}" if highest_rate > 0 else "0.0%",
        "category_breakdown": category_breakdown,
        "country_breakdown": country_breakdown,
        # Shareable headline
        "headline": _generate_headline(total_tariff_you_pay, total_cart_price),
    }

    # ── Step 3: Smart Swap Suggestions ──
    # Rank items by tariff DOLLAR impact, pick top N, find alternatives only for those
    swap_suggestions = _build_swap_suggestions(
        analyzed_items=analyzed_items,
        classify_fn=classify_fn,
        use_ai=use_ai,
        max_swaps=max_swap_suggestions,
        alts_per_item=alts_per_swap,
    )

    # Calculate potential savings if user swaps all suggested items
    potential_savings = round(
        sum(s.get("potential_savings", 0) for s in swap_suggestions), 2
    )
    summary["potential_savings"] = potential_savings
    summary["swap_count"] = len(swap_suggestions)

    return {
        "store": cart_data.get("store", "Unknown"),
        "extraction": {
            "items_detected": cart_data.get("items_detected", len(items)),
            "confidence": cart_data.get("confidence", "medium"),
            "notes": cart_data.get("notes", ""),
        },
        "analyzed_items": analyzed_items,
        "swap_suggestions": swap_suggestions,
        "summary": summary,
    }


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _build_swap_suggestions(
    analyzed_items: list[dict],
    classify_fn,
    use_ai: bool,
    max_swaps: int = 3,
    alts_per_item: int = 2,
) -> list[dict]:
    """
    Find smarter alternatives for the highest tariff-impact items in the cart.

    Strategy:
      1. Rank analyzed items by tariff_you_pay (dollar impact, not just rate)
      2. Pick the top N worst offenders
      3. For each, search for alternatives that are cheaper AND/OR lower tariff
      4. Return structured swap suggestions

    This is surgical — we only burn SerpAPI calls on the items where
    swapping would actually save the user the most money.
    """
    from product_search import search_alternatives, enrich_and_filter_alternatives

    # Only consider items that were successfully analyzed
    valid_items = [
        item for item in analyzed_items
        if "error" not in item and item.get("tariff_you_pay", 0) > 0
    ]

    # Rank by tariff DOLLAR impact (not rate) — a 10% tariff on a $500 item
    # matters more than a 50% tariff on a $5 item
    valid_items.sort(key=lambda x: x.get("tariff_you_pay", 0), reverse=True)

    # Pick top N
    top_offenders = valid_items[:max_swaps]

    swap_suggestions = []

    for item in top_offenders:
        product_name = item["product_name"]
        original_price = item["unit_price"]
        original_tariff_rate = item.get("tariff_rate", 0)
        original_tariff_cost = item.get("tariff_you_pay", 0)

        # Search for alternatives
        try:
            raw_alts = search_alternatives(
                product_name,
                category=item.get("category", ""),
                num_results=alts_per_item + 3,  # fetch extra, filtering will trim
            )
        except Exception as e:
            print(f"[TariffShield] Swap search failed for '{product_name[:30]}': {e}")
            raw_alts = []

        # Enrich + filter: only keep alternatives that are actually better
        filtered_alts = []
        if raw_alts and original_price > 0 and original_tariff_rate > 0:
            try:
                filtered_alts = enrich_and_filter_alternatives(
                    alternatives=raw_alts,
                    original_price=original_price,
                    original_tariff_rate=original_tariff_rate,
                    classify_fn=classify_fn,
                    use_ai=use_ai,
                )
                filtered_alts = filtered_alts[:alts_per_item]
            except Exception as e:
                print(f"[TariffShield] Swap filtering failed for '{product_name[:30]}': {e}")
                filtered_alts = []

        # Calculate best potential savings from the top alternative
        best_savings = 0.0
        if filtered_alts:
            best_alt = filtered_alts[0]
            # Savings = what you currently pay in tariff - what you'd pay with the alternative
            best_alt_tariff_cost = best_alt.get("tariff_cost", 0)
            best_savings = round(original_tariff_cost - best_alt_tariff_cost, 2)
            # Also factor in price difference
            price_diff = round(original_price - best_alt.get("price", original_price), 2)
            best_savings = round(best_savings + price_diff, 2)
            if best_savings < 0:
                best_savings = 0.0

        suggestion = {
            "original_item": {
                "product_name": product_name,
                "price": original_price,
                "tariff_rate": original_tariff_rate,
                "tariff_pct": item.get("tariff_pct", "0.0%"),
                "tariff_you_pay": original_tariff_cost,
                "country_of_origin": item.get("country_of_origin", "Unknown"),
                "hts_code": item.get("hts_code", ""),
            },
            "alternatives": filtered_alts,
            "alternatives_found": len(filtered_alts),
            "potential_savings": best_savings,
            "swap_verdict": _swap_verdict(filtered_alts, best_savings, original_tariff_cost),
        }

        swap_suggestions.append(suggestion)

    return swap_suggestions


def _swap_verdict(alternatives: list, best_savings: float, original_tariff_cost: float) -> str:
    """Generate a human-readable verdict for the swap suggestion."""
    if not alternatives:
        return "No better alternatives found — this may be the best option available."

    if best_savings <= 0:
        return "Alternatives exist but don't offer meaningful savings."

    savings_pct = (best_savings / original_tariff_cost * 100) if original_tariff_cost > 0 else 0

    if savings_pct >= 50:
        return f"Strong swap — save ${best_savings:.2f} ({savings_pct:.0f}% less tariff exposure)"
    elif savings_pct >= 20:
        return f"Good swap — save ${best_savings:.2f} with a lower-tariff alternative"
    else:
        return f"Marginal swap — ${best_savings:.2f} savings available"


def _empty_summary() -> dict:
    return {
        "store": "Unknown",
        "total_items": 0,
        "total_cart_price": 0,
        "total_tariff_cost_raw": 0,
        "total_tariff_you_pay": 0,
        "tariff_as_pct_of_cart": "0.0%",
        "price_without_tariffs": 0,
        "highest_tariff_item": None,
        "highest_tariff_rate": "0.0%",
        "category_breakdown": {},
        "country_breakdown": {},
        "potential_savings": 0,
        "swap_count": 0,
        "headline": "Upload a cart screenshot to see your hidden tariff tax!",
    }


def _generate_headline(tariff_you_pay: float, cart_total: float) -> str:
    """Generate a punchy shareable headline for the cart analysis."""
    if cart_total <= 0:
        return "Upload a cart screenshot to see your hidden tariff tax!"

    pct = (tariff_you_pay / cart_total) * 100

    if pct >= 30:
        return f"${tariff_you_pay:.2f} of your ${cart_total:.2f} cart is hidden tariff tax. That's {pct:.0f}% you didn't know about."
    elif pct >= 15:
        return f"You're paying ${tariff_you_pay:.2f} in hidden tariffs on a ${cart_total:.2f} cart — {pct:.0f}% invisible markup."
    elif pct >= 5:
        return f"${tariff_you_pay:.2f} in tariffs hiding in your ${cart_total:.2f} cart ({pct:.1f}% of total)."
    else:
        return f"Your ${cart_total:.2f} cart has ${tariff_you_pay:.2f} in tariff costs — relatively low exposure!"


# ─────────────────────────────────────────────
# CLI TEST (with a sample image file)
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python cart_analyzer.py <path_to_cart_screenshot>")
        print("Example: python cart_analyzer.py cart.png")
        sys.exit(1)

    image_path = sys.argv[1]

    # Determine media type
    ext = image_path.lower().rsplit(".", 1)[-1]
    media_types = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
        "gif": "image/gif",
    }
    media_type = media_types.get(ext, "image/png")

    # Read and encode
    with open(image_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode("utf-8")

    print(f"Analyzing cart screenshot: {image_path}")
    print(f"Image size: {len(image_data) // 1024}KB (base64)")
    print("=" * 55)

    result = analyze_cart(image_data, media_type)

    summary = result["summary"]
    print(f"\nStore: {result['store']}")
    print(f"Items detected: {summary['total_items']}")
    print(f"Cart total: ${summary['total_cart_price']:.2f}")
    print(f"Hidden tariff cost: ${summary['total_tariff_you_pay']:.2f}")
    print(f"Tariff % of cart: {summary['tariff_as_pct_of_cart']}")
    print(f"Highest tariff item: {summary['highest_tariff_item']} ({summary['highest_tariff_rate']})")

    print(f"\n{'─' * 55}")
    print("Per-item breakdown:")
    for item in result["analyzed_items"]:
        if "error" in item:
            print(f"  ! {item['product_name']}: {item['error']}")
            continue
        print(f"  {item['product_name'][:45]}")
        print(f"    ${item['line_total']:.2f} | {item['country_of_origin']} | "
              f"Tariff: {item['tariff_pct']} -> ${item['tariff_you_pay']:.2f}")

    # Show swap suggestions
    swaps = result.get("swap_suggestions", [])
    if swaps:
        print(f"\n{'=' * 55}")
        print(f"SMART SWAP SUGGESTIONS (top {len(swaps)} tariff offenders):")
        print(f"{'=' * 55}")
        for i, swap in enumerate(swaps, 1):
            orig = swap["original_item"]
            print(f"\n  [{i}] {orig['product_name'][:45]}")
            print(f"      Current: ${orig['price']:.2f} | "
                  f"{orig['country_of_origin']} | Tariff: {orig['tariff_pct']}")
            print(f"      Verdict: {swap['swap_verdict']}")

            for j, alt in enumerate(swap["alternatives"], 1):
                print(f"      -> Alt {j}: {alt['title'][:40]}")
                print(f"         ${alt.get('price', 0):.2f} | "
                      f"{alt.get('country_of_origin', '?')} | "
                      f"Tariff: {alt.get('tariff_pct', '?')}")
                print(f"         {alt.get('tariff_advantage', '')}")

            if not swap["alternatives"]:
                print(f"      -> No better alternatives found")

        print(f"\n  Total potential savings: ${summary.get('potential_savings', 0):.2f}")

    print(f"\n{'─' * 55}")
    print(f"  {summary['headline']}")
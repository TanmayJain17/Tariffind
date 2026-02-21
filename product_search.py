"""
Tariffind — Product Search (SerpAPI)
=======================================
Searches Google Shopping for real products with prices, images, and buy links.
Also finds lower-tariff alternatives.

Requires: SERPAPI_KEY env var or pass api_key directly.
Free tier: 100 searches/month (plenty for hackathon demo).
"""
import os
import json
import requests
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

SERPAPI_BASE = "https://serpapi.com/search.json"


def _get_key(api_key: str = None) -> str:
    key = api_key or os.environ.get("SERPAPI_KEY") or os.environ.get("SERPAPI_API_KEY")
    if not key:
        raise ValueError("No SerpAPI key. Set SERPAPI_KEY env var.")
    return key


# ─────────────────────────────────────────────
# GOOGLE SHOPPING SEARCH
# ─────────────────────────────────────────────

def search_products(query: str, num_results: int = 8,
                    api_key: str = None) -> list[dict]:
    """
    Search Google Shopping for real products.
    Returns list of products with: title, price, link, source, thumbnail, etc.
    """
    key = _get_key(api_key)

    params = {
        "engine": "google_shopping",
        "q": query,
        "api_key": key,
        "gl": "us",
        "hl": "en",
        "num": num_results,
    }

    resp = requests.get(SERPAPI_BASE, params=params, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    results = []
    for item in data.get("shopping_results", [])[:num_results]:
        product = {
            "title": item.get("title", ""),
            "price": item.get("extracted_price"),
            "price_str": item.get("price", ""),
            "source": item.get("source", ""),
            "link": item.get("link", ""),
            "product_link": item.get("product_link", ""),
            "thumbnail": item.get("thumbnail", ""),
            "rating": item.get("rating"),
            "reviews": item.get("reviews"),
            "delivery": item.get("delivery", ""),
        }
        results.append(product)

    return results


# ─────────────────────────────────────────────
# FIND ALTERNATIVES WITH LOWER TARIFF EXPOSURE
# ─────────────────────────────────────────────

# Countries with lower tariff exposure (no Section 301, no IEEPA)
LOW_TARIFF_ORIGINS = {
    "USA": "made in USA",
    "Mexico": "made in Mexico",       # USMCA
    "Canada": "made in Canada",       # USMCA
    "South Korea": "made in Korea",   # FTA
    "Japan": "made in Japan",
    "Germany": "made in Germany",
    "UK": "made in UK",
}


def search_alternatives(product_name: str, category: str = "",
                         num_results: int = 5,
                         api_key: str = None) -> list[dict]:
    """
    Search for alternative products that may have lower tariff exposure.
    Tries domestic/FTA-origin products first.
    """
    key = _get_key(api_key)
    alternatives = []
    seen_titles = set()

    # Strategy 1: Search for "made in USA" version
    for origin_label, search_suffix in [
        ("USA", "made in USA"),
        ("USMCA", "made in Mexico OR made in Canada"),
    ]:
        query = f"{product_name} {search_suffix}"
        params = {
            "engine": "google_shopping",
            "q": query,
            "api_key": key,
            "gl": "us",
            "hl": "en",
            "num": 4,
        }

        try:
            resp = requests.get(SERPAPI_BASE, params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()

            for item in data.get("shopping_results", [])[:3]:
                title = item.get("title", "")
                if title.lower() in seen_titles:
                    continue
                seen_titles.add(title.lower())

                alternatives.append({
                    "title": title,
                    "price": item.get("extracted_price"),
                    "price_str": item.get("price", ""),
                    "source": item.get("source", ""),
                    "link": item.get("link", ""),
                    "product_link": item.get("product_link", ""),
                    "thumbnail": item.get("thumbnail", ""),
                    "rating": item.get("rating"),
                    "reviews": item.get("reviews"),
                    "origin_hint": origin_label,
                    "tariff_advantage": "Potentially lower tariffs (domestic/FTA)",
                })
        except Exception as e:
            print(f"[Tariffind] Alternative search failed for {origin_label}: {e}")
            continue

        if len(alternatives) >= num_results:
            break

    return alternatives[:num_results]


# ─────────────────────────────────────────────
# FULL PRODUCT SEARCH PIPELINE
# ─────────────────────────────────────────────

def search_and_analyze(query: str, api_key: str = None) -> dict:
    """
    Full search pipeline:
    1. Search Google Shopping for the product
    2. Return results for the frontend to display
    
    Classification + tariff lookup happens separately via /analyze endpoint.
    """
    products = search_products(query, num_results=8, api_key=api_key)

    return {
        "query": query,
        "results_count": len(products),
        "products": products,
    }


# ─────────────────────────────────────────────
# CLI TEST
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Samsung 55 inch TV"

    print(f"Searching Google Shopping for: '{query}'")
    print("=" * 55)

    try:
        results = search_products(query, num_results=5)
        for i, p in enumerate(results, 1):
            print(f"\n  [{i}] {p['title'][:60]}")
            print(f"      Price: {p['price_str']}  |  Store: {p['source']}")
            print(f"      Link: {p['link'][:80]}...")
            if p.get("rating"):
                print(f"      Rating: {p['rating']} ({p.get('reviews', '?')} reviews)")

        print(f"\n{'=' * 55}")
        print(f"Searching for lower-tariff alternatives...")
        alts = search_alternatives(query, num_results=3)
        for i, a in enumerate(alts, 1):
            print(f"\n  [ALT {i}] {a['title'][:60]}")
            print(f"      Price: {a['price_str']}  |  Store: {a['source']}")
            print(f"      Origin hint: {a['origin_hint']}")
            print(f"      {a['tariff_advantage']}")

    except ValueError as e:
        print(f"ERROR: {e}")
        print("Set SERPAPI_KEY=your_key and try again.")
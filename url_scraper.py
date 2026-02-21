"""
Tariffind — Product URL Scraper
====================================
Paste an Amazon, Walmart, or Best Buy URL → extract product name, price, store.
Uses SerpAPI's Google Shopping reverse lookup or direct page scraping.
"""

import os
import re
import json
import requests
from urllib.parse import urlparse, unquote
from typing import Optional

# Try importing BeautifulSoup for direct scraping fallback
try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False


# ─────────────────────────────────────────────
# URL DETECTION
# ─────────────────────────────────────────────

SUPPORTED_DOMAINS = {
    "amazon.com": "amazon",
    "www.amazon.com": "amazon",
    "walmart.com": "walmart",
    "www.walmart.com": "walmart",
    "bestbuy.com": "bestbuy",
    "www.bestbuy.com": "bestbuy",
    "target.com": "target",
    "www.target.com": "target",
    "newegg.com": "newegg",
    "www.newegg.com": "newegg",
    "ebay.com": "ebay",
    "www.ebay.com": "ebay",
}


def is_product_url(text: str) -> bool:
    """Check if input looks like a product URL."""
    text = text.strip()
    if not text.startswith(("http://", "https://")):
        return False
    try:
        parsed = urlparse(text)
        return parsed.hostname in SUPPORTED_DOMAINS or "." in (parsed.hostname or "")
    except Exception:
        return False


def detect_store(url: str) -> str:
    """Detect which store the URL is from."""
    try:
        host = urlparse(url).hostname or ""
        return SUPPORTED_DOMAINS.get(host, "unknown")
    except Exception:
        return "unknown"


# ─────────────────────────────────────────────
# EXTRACT PRODUCT NAME FROM URL PATH
# ─────────────────────────────────────────────

def _extract_name_from_url(url: str) -> Optional[str]:
    """
    Try to extract a product name from the URL path itself.
    Amazon: /dp/B0xxx/Product-Name-Here
    Walmart: /ip/Product-Name-Here/12345
    """
    try:
        parsed = urlparse(url)
        path = unquote(parsed.path)
        store = detect_store(url)

        if store == "amazon":
            # Amazon URLs: /Product-Name/dp/B0XXX or /dp/B0XXX
            parts = path.split("/")
            for i, part in enumerate(parts):
                if part == "dp" and i > 0 and parts[i-1] not in ("", "dp"):
                    name = parts[i-1].replace("-", " ").strip()
                    if len(name) > 5:
                        return name
            # Try the slug after /dp/
            for part in parts:
                if len(part) > 10 and "-" in part and not part.startswith("B0"):
                    return part.replace("-", " ").strip()

        elif store == "walmart":
            # Walmart URLs: /ip/Product-Name-Here/12345
            parts = path.split("/")
            for i, part in enumerate(parts):
                if part == "ip" and i + 1 < len(parts):
                    name = parts[i+1].replace("-", " ").strip()
                    # Skip if it's just a numeric ID
                    if len(name) > 5 and not name.replace(" ", "").isdigit():
                        return name

        elif store == "bestbuy":
            # Best Buy: /site/Product-Name/1234567.p
            parts = path.split("/")
            for part in parts:
                if len(part) > 10 and "-" in part and not part.endswith(".p"):
                    return part.replace("-", " ").strip()

    except Exception:
        pass

    return None


# ─────────────────────────────────────────────
# CLAUDE-BASED URL ANALYSIS
# ─────────────────────────────────────────────

def _extract_with_claude(url: str, api_key: str = None) -> Optional[dict]:
    """
    Use Claude to extract product info from a URL.
    Claude knows common URL patterns and product naming conventions.
    """
    key = api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return None

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=key)

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=500,
            system=(
                "You extract product information from e-commerce URLs. "
                "Given a URL, determine the product name, likely price range, "
                "store name, and likely country of manufacture. "
                "Return ONLY valid JSON: "
                '{"product_name": "...", "store": "...", "estimated_price": number_or_null, '
                '"country_of_origin": "...", "category": "..."}'
            ),
            messages=[{"role": "user", "content": f"Extract product info from this URL: {url}"}],
        )

        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text.rsplit("```", 1)[0]
            text = text.strip()

        return json.loads(text)

    except Exception as e:
        print(f"[Tariffind] Claude URL extraction failed: {e}")
        return None


# ─────────────────────────────────────────────
# SERPAPI PRODUCT LOOKUP
# ─────────────────────────────────────────────

def _search_product_by_name(product_name: str, api_key: str = None) -> Optional[dict]:
    """Search SerpAPI for the product to get real price and details."""
    key = api_key or os.environ.get("SERPAPI_KEY") or os.environ.get("SERPAPI_API_KEY")
    if not key:
        return None

    try:
        params = {
            "engine": "google_shopping",
            "q": product_name,
            "api_key": key,
            "gl": "us",
            "hl": "en",
            "num": 3,
        }
        resp = requests.get("https://serpapi.com/search.json", params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        results = data.get("shopping_results", [])
        if results:
            top = results[0]
            return {
                "title": top.get("title", ""),
                "price": top.get("extracted_price"),
                "price_str": top.get("price", ""),
                "source": top.get("source", ""),
                "link": top.get("link", ""),
                "thumbnail": top.get("thumbnail", ""),
            }
    except Exception as e:
        print(f"[Tariffind] SerpAPI product lookup failed: {e}")

    return None


# ─────────────────────────────────────────────
# MAIN: EXTRACT PRODUCT FROM URL
# ─────────────────────────────────────────────

def extract_product_from_url(url: str) -> dict:
    """
    Main entry point. Given a product URL, extract all available info.
    
    Tries multiple strategies:
    1. Parse product name from URL structure
    2. Use Claude to analyze the URL
    3. Search SerpAPI with extracted name to get real price
    
    Returns dict with: product_name, price, store, thumbnail, original_url
    """
    url = url.strip()
    store = detect_store(url)

    result = {
        "original_url": url,
        "store": store,
        "product_name": None,
        "price": None,
        "price_str": None,
        "thumbnail": None,
        "country_of_origin": None,
        "extraction_method": None,
    }

    # Strategy 1: Extract name from URL path
    url_name = _extract_name_from_url(url)

    # Strategy 2: Claude analysis
    claude_data = _extract_with_claude(url)
    if claude_data:
        result["product_name"] = claude_data.get("product_name")
        result["price"] = claude_data.get("estimated_price")
        result["country_of_origin"] = claude_data.get("country_of_origin")
        result["extraction_method"] = "claude_ai"

    # Use URL-parsed name if Claude didn't give us one
    if not result["product_name"] and url_name:
        result["product_name"] = url_name
        result["extraction_method"] = "url_parsing"

    # Strategy 3: Search SerpAPI for real price/details
    search_name = result["product_name"] or url_name
    if not search_name:
        # Last resort: search the URL itself — Google Shopping often resolves it
        search_name = url

    if search_name:
        serp_data = _search_product_by_name(search_name)
        if serp_data:
            # SerpAPI gives us the real price and thumbnail
            if not result["product_name"] or len(serp_data.get("title", "")) > len(result["product_name"] or ""):
                result["product_name"] = serp_data["title"]
            result["price"] = serp_data.get("price") or result["price"]
            result["price_str"] = serp_data.get("price_str")
            result["thumbnail"] = serp_data.get("thumbnail")
            if result["extraction_method"]:
                result["extraction_method"] += "+serpapi"
            else:
                result["extraction_method"] = "serpapi"

    # Fallback: if we still have nothing, use the raw URL
    if not result["product_name"]:
        result["product_name"] = url
        result["extraction_method"] = "raw_url"

    return result


# ─────────────────────────────────────────────
# CLI TEST
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    test_urls = [
        "https://www.amazon.com/Samsung-Crystal-Processor-SmartTV-UN55DU7200FXZA/dp/B0CX53KY6L",
        "https://www.walmart.com/ip/Samsung-55-Class-Crystal-UHD-4K-Smart-TV/1234567890",
        "https://www.bestbuy.com/site/samsung-55-class-du7200-series-crystal-uhd-4k-smart-tizen-tv/6576014.p",
    ]

    urls = sys.argv[1:] if len(sys.argv) > 1 else test_urls

    for url in urls:
        print(f"\n{'=' * 55}")
        print(f"  URL: {url[:70]}...")
        print(f"{'=' * 55}")

        result = extract_product_from_url(url)
        print(f"  Store: {result['store']}")
        print(f"  Product: {result['product_name']}")
        print(f"  Price: {result.get('price_str') or result.get('price') or 'Unknown'}")
        print(f"  Country: {result.get('country_of_origin') or 'Unknown'}")
        print(f"  Method: {result['extraction_method']}")
        if result.get("thumbnail"):
            print(f"  Thumbnail: {result['thumbnail'][:60]}...")
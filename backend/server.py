"""
TariffShield API Server (v2)
============================
Thin routing layer — all logic lives in dedicated modules.

Modules:
  tariff_engine.py      — HTS CSV lookup + tariff calculation
  product_classifier.py — Claude AI + fallback product classification
  product_search.py     — SerpAPI Google Shopping search + alternatives
  price_history.py      — AI-estimated price timeline with tariff annotations
  url_scraper.py        — Extract product info from Amazon/Walmart/BestBuy URLs
  dashboard.py          — Tariff Tax Dashboard (Spotify Wrapped for tariffs)
  cart_analyzer.py      — Shopping cart screenshot → per-item tariff analysis

Endpoints:
  POST /search          — Search Google Shopping for real products
  POST /analyze         — Classify + tariff breakdown for a specific product
  POST /full-pipeline   — One-shot: input → search → classify → tariff → alternatives → history
  POST /alternatives    — Find lower-tariff alternatives
  POST /cart-analyze    — Upload cart screenshot → extract items → total tariff exposure
  POST /dashboard       — Tariff Tax Dashboard from purchase list
  POST /price-history   — AI-estimated price history with tariff annotations
  POST /lookup          — Direct HTS code lookup
  GET  /categories      — List supported categories
  GET  /health          — Health check
"""
import os
from dotenv import load_dotenv

load_dotenv()

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

# ── Module imports ──
from tariff_engine import lookup_tariff, CATEGORY_LABELS
from product_classifier import _fallback_classify, classify_product_sync
from product_search import search_products, search_alternatives, enrich_and_filter_alternatives
from price_history import estimate_price_history
from url_scraper import is_product_url, extract_product_from_url
from dashboard import build_price_impact, generate_dashboard, get_passthrough_rate
from cart_analyzer import analyze_cart


app = FastAPI(
    title="TariffShield API",
    description="See the invisible tax. Real products, real tariff breakdowns, real alternatives.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# REQUEST MODELS
# ─────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str = Field(..., description="Product search query")
    num_results: int = Field(8, description="Number of results to return")


class AnalyzeRequest(BaseModel):
    product: str = Field(..., description="Product name or description")
    price: Optional[float] = Field(None, description="Product price in USD")
    use_ai: bool = Field(True, description="Use Claude API for classification")


class FullPipelineRequest(BaseModel):
    query: str = Field(..., description="Product search query OR product URL")
    use_ai: bool = Field(True, description="Use Claude API for classification")
    num_alternatives: int = Field(4, description="Number of alternatives to find")


class AlternativesRequest(BaseModel):
    product_name: str = Field(..., description="Product name to find alternatives for")
    category: str = Field("", description="Product category hint")
    num_results: int = Field(5, description="Number of alternatives")


class DashboardRequest(BaseModel):
    purchases: list[dict] = Field(
        ...,
        description="List of purchases: [{product, price, country_of_origin (optional)}]",
    )


class PriceHistoryRequest(BaseModel):
    product_name: str = Field(..., description="Product name")
    current_price: float = Field(..., description="Current retail price")
    country_of_origin: str = Field("China", description="Country of origin")
    category: str = Field("", description="Product category")


class DirectLookupRequest(BaseModel):
    hts_code: str
    country: str = "CN"
    price: Optional[float] = None


class CartAnalyzeRequest(BaseModel):
    image_data: str = Field(..., description="Base64-encoded cart screenshot")
    media_type: str = Field("image/png", description="Image MIME type (image/png, image/jpeg, image/webp)")
    use_ai: bool = Field(True, description="Use Claude for product classification")
    max_swap_suggestions: int = Field(3, description="Number of high-tariff items to find swaps for")
    alts_per_swap: int = Field(2, description="Number of alternatives per swap suggestion")


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _classify(product_name: str, use_ai: bool = True) -> dict:
    """Classify product with AI or fallback."""
    if use_ai:
        try:
            return classify_product_sync(product_name)
        except Exception as e:
            print(f"[TariffShield] AI classification failed, using fallback: {e}")
            return _fallback_classify(product_name)
    return _fallback_classify(product_name)


def _build_tariff_response(classification: dict, price: float = None) -> dict:
    """Classify → tariff lookup → price impact with pass-through adjustment."""
    result = lookup_tariff(
        classification["hts_code"],
        classification.get("country_of_origin", "CN")
    )

    tariff_data = {
        "hts_code": result.hts_code,
        "country": result.country,
        "country_name": result.country_name,
        "category": result.category,
        "category_label": result.category_label,
        "product_description": result.product_description,
        "mfn_base_rate": result.mfn_base_rate,
        "fta_adjusted_rate": result.fta_adjusted_rate,
        "section_301_rate": result.section_301_rate,
        "section_232_rate": result.section_232_rate,
        "ieepa_fentanyl_rate": result.ieepa_fentanyl_rate,
        "section_122_rate": result.section_122_rate,
        "total_rate": result.total_rate,
        "total_pct": result.total_pct,
        "breakdown": result.breakdown,
        "raw_rate_string": result.raw_rate_string,
        "consumer_passthrough_rate": get_passthrough_rate(result.category),
    }

    price_impact = None
    if price and price > 0:
        raw_tariff_cost = result.tariff_on_price(price)
        price_impact = build_price_impact(
            price, raw_tariff_cost, result.category, result.category_label
        )

    return {
        "classification": classification,
        "tariff": tariff_data,
        "price_impact": price_impact,
    }


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "TariffShield API",
        "version": "0.2.0",
        "tariff_data": "Post-SCOTUS Feb 20, 2026",
        "features": ["search", "classify", "tariff", "alternatives", "price_history", "dashboard", "cart_analyze"],
    }


@app.post("/search")
def search(req: SearchRequest):
    """Search Google Shopping for real products with prices and buy links."""
    try:
        products = search_products(req.query, num_results=req.num_results)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Search failed: {e}")
    return {"query": req.query, "results_count": len(products), "products": products}


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    """Classify a product and return tariff breakdown."""
    classification = _classify(req.product, req.use_ai)
    if not classification or "hts_code" not in classification:
        raise HTTPException(status_code=422, detail="Could not classify product")
    response = _build_tariff_response(classification, req.price)
    response["product_input"] = req.product
    return response


@app.post("/full-pipeline")
def full_pipeline(req: FullPipelineRequest):
    """
    THE MAIN ENDPOINT — accepts text search OR product URL:
    1. Detect URL vs search query
    2. Search / extract product info
    3. Classify → tariff breakdown
    4. Find lower-tariff alternatives (NOW with price + tariff filtering!)
    5. Estimate price history
    """
    query = req.query.strip()

    # Step 1: URL vs text
    if is_product_url(query):
        url_data = extract_product_from_url(query)
        product_name = url_data.get("product_name") or query
        price = url_data.get("price")

        top_product = {
            "title": product_name,
            "price": price,
            "price_str": url_data.get("price_str") or (f"${price:.2f}" if price else ""),
            "source": url_data.get("store", ""),
            "link": query,
            "product_link": query,
            "thumbnail": url_data.get("thumbnail", ""),
        }
        try:
            products = search_products(product_name, num_results=5)
        except Exception:
            products = []
        products = [top_product] + products
        search_query = product_name
    else:
        search_query = query
        try:
            products = search_products(query, num_results=6)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Product search failed: {e}")
        if not products:
            raise HTTPException(status_code=404, detail="No products found")
        top_product = products[0]
        product_name = top_product.get("title", query)
        price = top_product.get("price")

    # Step 2: Classify
    classification = _classify(product_name, req.use_ai)
    if not classification or "hts_code" not in classification:
        raise HTTPException(status_code=422, detail="Could not classify product")

    # Step 3: Tariff breakdown
    tariff_response = _build_tariff_response(classification, price)

    # Step 4: Alternatives — NOW with actual tariff + price validation!
    try:
        # Fetch extra candidates since filtering will remove some
        raw_alternatives = search_alternatives(
            search_query,
            category=classification.get("category", ""),
            num_results=req.num_alternatives + 4,
        )

        original_tariff_rate = tariff_response["tariff"]["total_rate"]
        original_price = price or 0

        if original_price > 0 and original_tariff_rate > 0:
            # Enrich each alternative with real tariff data,
            # filter out those that aren't cheaper OR lower-tariff
            alternatives = enrich_and_filter_alternatives(
                alternatives=raw_alternatives,
                original_price=original_price,
                original_tariff_rate=original_tariff_rate,
                classify_fn=_classify,
                use_ai=req.use_ai,
            )
            # Cap to requested number after filtering
            alternatives = alternatives[:req.num_alternatives]
        else:
            # If we don't have price/tariff to compare against, return raw
            alternatives = raw_alternatives[:req.num_alternatives]

    except Exception as e:
        print(f"[TariffShield] Alternative search/filter failed: {e}")
        alternatives = []

    # Step 5: Price history
    try:
        price_history_data = estimate_price_history(
            product_name,
            price or 0,
            classification.get("country_of_origin", "Unknown"),
            classification.get("category", ""),
        )
    except Exception as e:
        print(f"[TariffShield] Price history failed: {e}")
        price_history_data = None

    return {
        "query": req.query,
        "selected_product": top_product,
        "all_search_results": products,
        "classification": tariff_response["classification"],
        "tariff": tariff_response["tariff"],
        "price_impact": tariff_response["price_impact"],
        "alternatives": alternatives,
        "price_history": price_history_data,
    }


@app.post("/alternatives")
def get_alternatives(req: AlternativesRequest):
    """Find lower-tariff alternative products."""
    try:
        alternatives = search_alternatives(
            req.product_name, category=req.category, num_results=req.num_results,
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Alternative search failed: {e}")
    return {"product_name": req.product_name, "alternatives_count": len(alternatives), "alternatives": alternatives}


@app.post("/dashboard")
def tariff_tax_dashboard(req: DashboardRequest):
    """
    TARIFF TAX DASHBOARD — The "Spotify Wrapped" for tariffs.
    Submit purchases → total tariff tax, category breakdown, shareable card.
    """
    items = []
    for purchase in req.purchases:
        product_name = purchase.get("product", "Unknown")
        price = purchase.get("price", 0)
        if not price or price <= 0:
            continue

        classification = _classify(product_name, use_ai=True)
        if not classification or "hts_code" not in classification:
            continue

        tariff_data = _build_tariff_response(classification, price)
        impact = tariff_data.get("price_impact")
        tariff_you_pay = impact["estimated_tariff_you_pay"] if impact else 0

        items.append({
            "product": product_name,
            "price": price,
            "tariff_you_pay": tariff_you_pay,
            "tariff_rate": tariff_data["tariff"]["total_pct"],
            "country": tariff_data["tariff"]["country_name"],
            "category": tariff_data["tariff"]["category_label"],
        })

    return generate_dashboard(items)


@app.post("/price-history")
def price_history(req: PriceHistoryRequest):
    """Get AI-estimated price history with tariff policy annotations."""
    try:
        history = estimate_price_history(
            req.product_name, req.current_price, req.country_of_origin, req.category,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Price history failed: {e}")
    return history


@app.post("/lookup")
def direct_lookup(req: DirectLookupRequest):
    """Direct HTS code + country lookup."""
    result = lookup_tariff(req.hts_code, req.country)
    response = result.to_dict()
    if req.price and req.price > 0:
        raw_tariff_cost = result.tariff_on_price(req.price)
        response["price_impact"] = build_price_impact(
            req.price, raw_tariff_cost, result.category, result.category_label
        )
    return response


@app.get("/categories")
def list_categories():
    return {"categories": CATEGORY_LABELS}


@app.post("/cart-analyze")
def cart_analyze(req: CartAnalyzeRequest):
    """
    CART TARIFF ANALYZER — Upload a shopping cart screenshot.
    Claude Vision extracts every item, then each gets classified + tariff breakdown.
    Returns per-item analysis, aggregate cart tariff summary, and smart swap
    suggestions for the highest-tariff items with cheaper/lower-tariff alternatives.
    """
    if not req.image_data:
        raise HTTPException(status_code=400, detail="No image data provided")

    # Validate media type
    allowed_types = {"image/png", "image/jpeg", "image/webp", "image/gif"}
    if req.media_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported media type. Use one of: {', '.join(allowed_types)}",
        )

    try:
        result = analyze_cart(
            image_data=req.image_data,
            media_type=req.media_type,
            classify_fn=_classify,
            use_ai=req.use_ai,
            max_swap_suggestions=req.max_swap_suggestions,
            alts_per_swap=req.alts_per_swap,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cart analysis failed: {e}")

    return result


if __name__ == "__main__":
    import uvicorn
    print("=" * 50)
    print("  TariffShield API v0.2.0")
    print("  http://localhost:8000/docs")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000)
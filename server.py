"""
Tariffind API Server (v2)
============================
Full pipeline: search real products → classify → tariff breakdown → alternatives.

Endpoints:
  POST /search          — Search Google Shopping for real products
  POST /analyze         — Classify + tariff breakdown for a specific product
  POST /full-pipeline   — One-shot: search → pick top result → classify → tariff → alternatives
  POST /alternatives    — Find lower-tariff alternatives for a product
  POST /lookup          — Direct HTS code lookup (skip classification)
  GET  /categories      — List supported categories
  GET  /health          — Health check

Env vars needed:
  ANTHROPIC_API_KEY  — Claude API for classification
  SERPAPI_KEY        — SerpAPI for Google Shopping search
"""
import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

from tariff_engine import lookup_tariff, CATEGORY_LABELS
from product_classifier import _fallback_classify, classify_product_sync
from product_search import search_products, search_alternatives

app = FastAPI(
    title="Tariffind API",
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
# REQUEST / RESPONSE MODELS
# ─────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str = Field(..., description="Product search query")
    num_results: int = Field(8, description="Number of results to return")


class AnalyzeRequest(BaseModel):
    product: str = Field(..., description="Product name or description")
    price: Optional[float] = Field(None, description="Product price in USD")
    use_ai: bool = Field(True, description="Use Claude API for classification")


class FullPipelineRequest(BaseModel):
    query: str = Field(..., description="Product search query")
    use_ai: bool = Field(True, description="Use Claude API for classification")
    num_alternatives: int = Field(4, description="Number of alternatives to find")


class AlternativesRequest(BaseModel):
    product_name: str = Field(..., description="Product name to find alternatives for")
    category: str = Field("", description="Product category hint")
    num_results: int = Field(5, description="Number of alternatives")


class DirectLookupRequest(BaseModel):
    hts_code: str
    country: str = "CN"
    price: Optional[float] = None


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _classify(product_name: str, use_ai: bool = True) -> dict:
    if use_ai:
        try:
            return classify_product_sync(product_name)
        except Exception as e:
            print(f"[Tariffind] AI classification failed, using fallback: {e}")
            return _fallback_classify(product_name)
    return _fallback_classify(product_name)


def _build_tariff_response(classification: dict, price: float = None) -> dict:
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
    }

    price_impact = None
    if price and price > 0:
        tariff_cost = result.tariff_on_price(price)
        price_impact = {
            "retail_price": price,
            "estimated_tariff_cost": round(tariff_cost, 2),
            "price_without_tariff": round(price - tariff_cost, 2),
            "tariff_share_of_price": f"{(tariff_cost / price) * 100:.1f}%",
        }

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
        "service": "Tariffind API",
        "version": "0.2.0",
        "tariff_data": "Post-SCOTUS Feb 20, 2026",
        "features": ["search", "classify", "tariff", "alternatives"],
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

    return {
        "query": req.query,
        "results_count": len(products),
        "products": products,
    }


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    """Classify a product and return tariff breakdown."""
    classification = _classify(req.product, req.use_ai)
    if not classification or "hts_code" not in classification:
        raise HTTPException(status_code=422, detail="Could not classify product")

    response = _build_tariff_response(classification, req.price)
    response["product_input"] = req.product
    response["scotus_note"] = (
        "SCOTUS struck down broad IEEPA tariffs on Feb 20, 2026. "
        "Section 301, 232, IEEPA fentanyl, and new Section 122 (10% blanket) remain."
    )
    return response


@app.post("/full-pipeline")
def full_pipeline(req: FullPipelineRequest):
    """
    THE MAIN ENDPOINT — Full user flow in one call:
    1. Search Google Shopping for real products
    2. Classify the top result
    3. Calculate tariff breakdown
    4. Find lower-tariff alternatives
    """
    # Step 1: Search
    try:
        products = search_products(req.query, num_results=6)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Product search failed: {e}")

    if not products:
        raise HTTPException(status_code=404, detail="No products found")

    # Step 2: Classify top result
    top_product = products[0]
    product_name = top_product.get("title", req.query)
    price = top_product.get("price")

    classification = _classify(product_name, req.use_ai)
    if not classification or "hts_code" not in classification:
        raise HTTPException(status_code=422, detail="Could not classify product")

    # Step 3: Tariff breakdown
    tariff_response = _build_tariff_response(classification, price)

    # Step 4: Alternatives
    try:
        alternatives = search_alternatives(
            req.query,
            category=classification.get("category", ""),
            num_results=req.num_alternatives,
        )
    except Exception as e:
        print(f"[Tariffind] Alternative search failed: {e}")
        alternatives = []

    return {
        "query": req.query,
        "selected_product": top_product,
        "all_search_results": products,
        "classification": tariff_response["classification"],
        "tariff": tariff_response["tariff"],
        "price_impact": tariff_response["price_impact"],
        "alternatives": alternatives,
        "scotus_note": (
            "SCOTUS struck down broad IEEPA tariffs on Feb 20, 2026. "
            "Section 301, 232, IEEPA fentanyl, and new Section 122 (10% blanket) remain."
        ),
    }


@app.post("/alternatives")
def get_alternatives(req: AlternativesRequest):
    """Find lower-tariff alternative products."""
    try:
        alternatives = search_alternatives(
            req.product_name,
            category=req.category,
            num_results=req.num_results,
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Alternative search failed: {e}")

    return {
        "product_name": req.product_name,
        "alternatives_count": len(alternatives),
        "alternatives": alternatives,
    }


@app.post("/lookup")
def direct_lookup(req: DirectLookupRequest):
    """Direct HTS code + country lookup."""
    result = lookup_tariff(req.hts_code, req.country)
    response = result.to_dict()
    if req.price and req.price > 0:
        tariff_cost = result.tariff_on_price(req.price)
        response["price_impact"] = {
            "retail_price": req.price,
            "estimated_tariff_cost": round(tariff_cost, 2),
            "price_without_tariff": round(req.price - tariff_cost, 2),
        }
    return response


@app.get("/categories")
def list_categories():
    return {"categories": CATEGORY_LABELS}


if __name__ == "__main__":
    import uvicorn
    print("=" * 50)
    print("  Tariffind API v0.2.0")
    print("  http://localhost:8000/docs for Swagger UI")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000)
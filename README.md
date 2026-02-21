# 🛡️ Tariffind — See the Invisible Tax

**Tariff intelligence for consumers.** Built at Tech@NYU Startup Week Buildathon 2026.

> *"The Supreme Court struck down tariffs this morning. Trump signed new ones by afternoon. You still don't know how much of what you're buying is inflated. Tariffind makes the invisible tax visible."*

## What It Does

Paste any product name → get an instant breakdown of exactly how much you're paying in tariffs, which trade policies are responsible, and find cheaper alternatives with lower tariff exposure.

## Architecture

```
User Input (product name/URL)
        │
        ▼
┌─────────────────────┐
│ Product Classifier   │  ← Claude Agent SDK (AI) or keyword fallback
│ name → HTS code +   │
│ country of origin    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Tariff Engine        │  ← Layered tariff calculation
│ MFN + Sec 301 +     │
│ Sec 232 + IEEPA +   │
│ Sec 122 (new!)      │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ API Server (FastAPI) │  ← REST endpoints
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Frontend (Lovable)   │  ← React UI
└─────────────────────┘
```

## Quick Start

```bash
pip install -r requirements.txt

# Run the API server
python server.py
# → http://localhost:8000

# Or test the engine directly
python tariff_engine.py
python product_classifier.py
```

## API Endpoints

### POST /analyze
```json
{
  "product": "Samsung 65 inch QLED TV",
  "price": 797.99
}
```

### POST /lookup
```json
{
  "hts_code": "8528.72.64",
  "country": "CN",
  "price": 797.99
}
```

## Tariff Layers (Post-SCOTUS, Feb 20 2026)

| Layer | Scope | Rate |
|-------|-------|------|
| MFN Base | All countries | Varies (0-32%) |
| Section 301 | China only | 7.5-25% |
| Section 232 | Steel/Aluminum/Autos (all countries) | 25% |
| IEEPA Fentanyl | China only | 20% |
| Section 122 (NEW) | All countries (post-SCOTUS) | 10% |

## Team

Built at Tech@NYU Startup Week Buildathon, Feb 20-22, 2026.

## Sponsor Integrations

- **Claude Agent SDK** — AI product classification engine
- **Lovable** — Frontend UI generation
- **ElevenLabs** — Voice tariff alerts
- **Databricks** — Tariff data pipeline

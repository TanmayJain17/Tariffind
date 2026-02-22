<p align="center" style="font-size: 96px; margin: 0;">🛡️</p>

<h1 align="center">TariffShield</h1>

<p align="center">
  <strong>See the invisible tax on everything you buy.</strong>
</p>

<p align="center">
  <em>Search any product. Paste any URL. Screenshot any cart.<br/>TariffShield reveals exactly how much of your purchase price is hidden tariff tax — and finds you cheaper, lower-tariff alternatives.</em>
</p>

<p align="center">
  <a href="#live-demo">Live Demo</a> •
  <a href="#the-problem">The Problem</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting Started</a>
</p>

---

## Live Demo

> 🔗 **Frontend**: [TariffShield.vercel.app](https://TariffShield.vercel.app)
> 🔗 **API Docs**: [api/docs](https://TariffShield-api.up.railway.app/docs)
> 🎥 **Demo Video**: [YouTube / Loom link]

---

## The Problem

In February 2026, the average American household pays **$3,800+/year in hidden tariff taxes** embedded in the prices of everyday products — and most people have no idea.

After the SCOTUS ruling striking down IEEPA "Liberation Day" tariffs (Feb 20, 2026), followed immediately by a new Section 122 blanket tariff, the tariff landscape is more confusing than ever. Consumers face a layered maze of trade policies:

- **Section 301** tariffs on China (up to 25%)
- **Section 232** tariffs on steel, aluminum, and autos (25%)
- **IEEPA fentanyl surcharge** on China (20%)
- **Section 122 blanket tariff** on all imports (10%, signed Feb 20, 2026)

These costs are invisible — baked into the sticker price with no label, no receipt line item, and no way for consumers to comparison shop around them.

**TariffShield makes the invisible visible.**

---

## How It Works

TariffShield is a tariff transparency engine that works in three modes:

### 1. 🔍 Search Any Product
Type a product name → TariffShield searches Google Shopping for real products, classifies them using AI, looks up the exact HTS tariff code against the real USITC database (29,796 codes), and breaks down every layer of tariff hitting that product.

### 2. 🔗 Paste Any URL
Drop an Amazon, Walmart, or Best Buy link → TariffShield extracts the product, identifies its country of origin, and shows you exactly how much of that price is tariff tax.

### 3. 📸 Screenshot Any Cart
Upload a screenshot of your shopping cart → Claude Vision reads every item and price, classifies each product, calculates the total hidden tariff across your entire cart, and suggests **smart swaps** for the top 3 highest-tariff items to maximize your savings.

---

## Features

### Tariff X-Ray
Every product gets a full breakdown: MFN base rate, Section 301, Section 232, IEEPA fentanyl surcharge, and the new Section 122 blanket — with consumer pass-through rates so you see what **you** actually pay, not just the theoretical rate.

### Smart Alternatives
Not just keyword matching — every suggested alternative runs through the **full classification + tariff pipeline** and is filtered by a composite score (60% price savings, 40% tariff savings). You only see alternatives that are genuinely better.

### Cart Analyzer with Smart Swaps
Upload a cart screenshot and get instant analysis. TariffShield ranks items by **dollar impact** (not just tariff rate), identifies the top 3 worst offenders, and finds validated alternatives for each. A $500 TV with 10% tariff gets flagged before a $5 item with 50% tariff — because that's what actually saves you money.

### Tariff Wrapped Dashboard
A Spotify Wrapped–style personal tariff report: total tariff tax you've paid, breakdown by category and country, your highest-tariff purchase, and a shareable headline card.

### Price History Timeline
AI-estimated price history annotated with the exact tariff policy events that caused each price jump — from the Section 301 escalations through Liberation Day to the SCOTUS ruling.

### Severity-Based Design Language
The entire UI communicates tariff severity through color: green (low, <10%), amber (moderate, 10-25%), orange (high, 25-40%), red (extreme, 40%+). This visual language carries through donut charts, stacked bars, cards, and data tables.

---

## Tech Stack

### Backend
| Component | Technology | Purpose |
|-----------|-----------|---------|
| API Server | **FastAPI** (Python) | 10 endpoints, async-ready |
| Tariff Database | **USITC HTS 2026 Rev. 3 CSV** | 29,796 real tariff codes |
| AI Classification | **Claude Sonnet 4** (Anthropic SDK) | Product → HTS code + country of origin |
| Vision Analysis | **Claude Vision** | Cart screenshot → structured item extraction |
| Product Search | **SerpAPI** (Google Shopping) | Real products, real prices, real buy links |
| URL Extraction | Claude AI + URL parsing + SerpAPI | Amazon/Walmart/BestBuy URL → product data |

### Frontend
| Component | Technology | Purpose |
|-----------|-----------|---------|
| Framework | **React 18 + TypeScript** | Type-safe component architecture |
| Build | **Vite** | Sub-second HMR, optimized builds |
| Styling | **Tailwind CSS + shadcn/ui** | Dark luxury fintech aesthetic |
| Animations | **Framer Motion** | Staggered reveals, chart animations |
| Charts | **Recharts** | Donut charts, area charts, stacked bars |
| Routing | **React Router** | Client-side navigation |
| Data Fetching | **React Query** | Caching, loading states, error handling |
| Share Cards | **html2canvas** | Exportable tariff report images |

### Infrastructure
| Component | Technology |
|-----------|-----------|
| Backend Hosting | **Railway** |
| Frontend Hosting | **Vercel** |
| AI Provider | **Anthropic (Claude)** |
| Search Provider | **SerpAPI** |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│  React + Vite + Tailwind + Framer Motion + Recharts         │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐   │
│  │  Search  │  │  URL     │  │  Cart    │  │  Tariff    │   │
│  │  Page    │  │  Paste   │  │  Upload  │  │  Wrapped   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘   │
└───────┼─────────────┼─────────────┼──────────────┼──────────┘
        │             │             │              │
        ▼             ▼             ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                     FastAPI BACKEND                         │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  /full-pipeline                      │   │
│  │  URL detect → Search → Classify → Tariff → Alts →    │   │
│  │  Price History                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  /cart-analyze                       │   │
│  │  Vision Extract → Classify Each → Tariff Each →      │   │
│  │  Aggregate → Rank by Impact → Smart Swap Top 3       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────────────────┐  │
│  │ tariff_     │ │ product_    │ │ product_search.py     │  │
│  │ engine.py   │ │ classifier  │ │ + enrich_and_filter   │  │
│  │ (29K HTS)   │ │ (Claude AI) │ │ (SerpAPI + validate)  │  │
│  └─────────────┘ └─────────────┘ └───────────────────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────────────────┐  │
│  │ cart_       │ │ price_      │ │ dashboard.py          │  │
│  │ analyzer.py │ │ history.py  │ │ (Tariff Wrapped)      │  │
│  │ (Vision)    │ │ (Timeline)  │ │                       │  │
│  └─────────────┘ └─────────────┘ └───────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

**Why composite scoring for alternatives?**
Early versions just searched for "made in USA" products and showed them. Problem: a $600 American-made TV isn't a useful "alternative" to a $400 Chinese TV with high tariffs. We now run every alternative through the full classify → tariff pipeline, filter out anything that isn't actually better on price *or* tariff, and sort by a weighted score (60% price, 40% tariff).

**Why rank cart swaps by dollar impact, not tariff rate?**
A 50% tariff on a $5 item = $2.50. A 10% tariff on a $500 item = $50. We surface the items where swapping will **actually save you the most money**, not just the items with the scariest percentage.

**Why consumer pass-through rates?**
A 25% tariff doesn't mean you pay 25% more. Manufacturers absorb some, retailers absorb some. Our pass-through model uses category-specific absorption rates (electronics: ~65%, clothing: ~80%, furniture: ~70%) so the "tariff you pay" number reflects reality, not theory.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/full-pipeline` | **Main endpoint** — text search or URL → complete analysis |
| `POST` | `/cart-analyze` | Cart screenshot → per-item tariff breakdown + smart swaps |
| `POST` | `/search` | Google Shopping product search |
| `POST` | `/analyze` | Classify + tariff breakdown for a single product |
| `POST` | `/alternatives` | Find lower-tariff alternatives |
| `POST` | `/dashboard` | Tariff Wrapped dashboard from purchase list |
| `POST` | `/price-history` | AI-estimated price timeline with policy annotations |
| `POST` | `/lookup` | Direct HTS code + country lookup |
| `GET`  | `/categories` | List supported product categories |
| `GET`  | `/health` | Health check |

Full interactive documentation available at `/docs` (Swagger UI).

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- [Anthropic API key](https://console.anthropic.com/)
- [SerpAPI key](https://serpapi.com/) (free tier: 100 searches/month)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your API keys:
#   ANTHROPIC_API_KEY=sk-ant-...
#   SERPAPI_KEY=...

# Run the server
uvicorn main:app --reload --port 8000
```

API docs available at `http://localhost:8000/docs`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set API URL (for local development)
echo "VITE_API_URL=http://localhost:8000" > .env.local

# Run dev server
npm run dev
```

App available at `http://localhost:5173`

### Quick Test

```bash
# Health check
curl http://localhost:8000/health

# Search a product
curl -X POST http://localhost:8000/full-pipeline \
  -H "Content-Type: application/json" \
  -d '{"query": "Samsung 55 inch TV"}'

# Direct HTS lookup
curl -X POST http://localhost:8000/lookup \
  -H "Content-Type: application/json" \
  -d '{"hts_code": "8528.72.64", "country": "CN", "price": 499.99}'
```

---


## Tariff Data Sources

TariffShield uses **real tariff data**, not estimates:

- **USITC HTS 2026 Revision 3 CSV** — 29,796 Harmonized Tariff Schedule codes with MFN duty rates, sourced from the US International Trade Commission
- **Section 301 tariff lists** — China-specific additional duties by HTS chapter
- **Section 232 rates** — 25% on steel (Ch. 72-73), aluminum (Ch. 76), and autos (8703-8704)
- **IEEPA fentanyl surcharge** — 20% on all Chinese imports (effective Feb 2025)
- **Section 122 blanket tariff** — 10% on all imports (signed Feb 20, 2026)
- **FTA/USMCA adjustments** — preferential rates for Canada, Mexico, South Korea, Australia, and other FTA partners

All data reflects the **post-SCOTUS landscape** as of February 20, 2026.

---

## Use of Claude (Anthropic)

TariffShield uses Claude extensively across multiple capabilities:

1. **Product Classification** (`product_classifier.py`) — Claude Sonnet classifies any product into its specific HTS tariff code and identifies the most likely country of manufacture. This is the core intelligence that maps "Nike Air Max 90" → HTS 6402.99.31, Vietnam.

2. **Cart Vision Analysis** (`cart_analyzer.py`) — Claude Vision reads shopping cart screenshots, extracting every product name, price, and quantity from complex e-commerce UIs (Amazon, Walmart, Target, etc.).

3. **URL Intelligence** (`url_scraper.py`) — Claude analyzes product URLs to determine the product identity and likely country of origin when URL parsing alone isn't sufficient.

4. **Price History Generation** (`price_history.py`) — Claude generates realistic price timelines annotated with the specific tariff policy events that caused each price movement.

All Claude integrations include a **keyword-based fallback classifier** so the app remains functional even without API access.

---

## Project Structure

```
TariffShield/
├── backend/
│   ├── main.py                  # FastAPI server, 10 endpoints
│   ├── tariff_engine.py         # HTS CSV loader + tariff calculator
│   ├── product_classifier.py    # Claude AI + keyword fallback classifier
│   ├── product_search.py        # SerpAPI search + alternative filtering
│   ├── cart_analyzer.py         # Cart screenshot → tariff analysis + swaps
│   ├── price_history.py         # AI-estimated price timeline
│   ├── url_scraper.py           # URL → product extraction
│   ├── dashboard.py             # Tariff Wrapped dashboard generator
│   ├── data/
│   │   └── hts_2026_revision_3_csv.csv   # Real USITC tariff data
│   ├── requirements.txt
│   ├── Procfile
│   └── railway.toml
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Index.tsx        # Landing page
│   │   │   ├── Results.tsx      # Product analysis view
│   │   │   └── Dashboard.tsx    # Tariff Wrapped dashboard
│   │   ├── components/
│   │   │   └── Navbar.tsx
│   │   └── lib/
│   │       └── api.ts           # API client
│   ├── vercel.json
│   ├── package.json
│   └── vite.config.ts
├── DEPLOY.md
└── README.md
```

---

## What's Next

If we continue building TariffShield beyond the hackathon:

- **Browser extension** — show tariff cost on Amazon/Walmart product pages inline as you browse
- **Real-time price tracking** — alert users when tariff policy changes affect products on their watchlist
- **Barcode/UPC scanning** — point your phone camera at any product in a physical store
- **Policy simulator** — "what would your cart cost if Section 301 tariffs were removed?"
- **Retailer partnerships** — help retailers surface lower-tariff alternatives to increase conversions

---

## Team

Built at **Tech@NYU Startup Week 2026 Buildathon** hosted by HOF Capital.

| Name | Role |
|------|------|
| Tanmay | Full Stack + AI Integration |
| | |
| | |

---

## Acknowledgments

- **Tech@NYU** and **HOF Capital** for hosting the Buildathon
- **Anthropic** for Claude API credits and the Claude Agent SDK
- **SerpAPI** for Google Shopping data access
- **USITC** for maintaining the public HTS tariff schedule

---

## License

Built for the 2026 Startup Week Buildathon. MIT License.

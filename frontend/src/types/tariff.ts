export interface TariffBreakdownItem {
  label: string;
  rate: string;
  rate_pct: number;
  type: string;
  note?: string;
}

export interface PriceImpact {
  retail_price: number;
  import_tariff_total: number;
  estimated_tariff_you_pay: number;
  estimated_pre_tariff_price: number;
  tariff_share_of_price: string;
  passthrough_rate: number;
  passthrough_note: string;
}

export interface Classification {
  product_name: string;
  hts_code: string;
  country_of_origin: string;
  country_name: string;
  description: string;
  category: string;
  confidence: string;
  notes: string;
}

export interface TariffData {
  hts_code: string;
  country: string;
  country_name: string;
  category: string;
  category_label: string;
  product_description: string;
  mfn_base_rate: string;
  section_301_rate: string;
  section_232_rate: string;
  ieepa_fentanyl_rate: string;
  section_122_rate: string;
  total_rate: number;
  total_pct: number;
  breakdown: TariffBreakdownItem[];
  consumer_passthrough_rate: number;
}

export interface PriceHistoryEntry {
  date: string;
  estimated_price: number;
  event: string;
  tariff_impact: string;
}

export interface PriceHistoryData {
  product: string;
  currency: string;
  current_price: number;
  estimated_pre_tariff_price: number;
  total_tariff_markup: number;
  timeline: PriceHistoryEntry[];
  confidence: string;
  disclaimer: string;
}

export interface Alternative {
  title: string;
  price: number | null;
  price_str: string;
  source: string;
  link: string;
  product_link: string;
  thumbnail: string;
  tariff_score?: string;
  tariff_rate?: number;
}

export interface SelectedProduct {
  title: string;
  price: number | null;
  price_str: string;
  source: string;
  link: string;
  product_link: string;
  thumbnail: string;
}

export interface FullPipelineResponse {
  query: string;
  selected_product: SelectedProduct;
  all_search_results: SelectedProduct[];
  classification: Classification;
  tariff: TariffData;
  price_impact: PriceImpact | null;
  alternatives: Alternative[];
  price_history: PriceHistoryData | null;
}

export interface StoredPurchase {
  product: string;
  price: number;
  tariff_rate: number;
  tariff_you_pay: number;
  country: string;
  category: string;
  timestamp: number;
}

// ── Cart Analysis Types ──

export interface CartAnalyzedItem {
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  hts_code?: string;
  country_of_origin?: string;
  country_code?: string;
  category?: string;
  tariff_rate?: number;
  tariff_pct?: string;
  raw_tariff_cost?: number;
  consumer_passthrough?: number;
  tariff_you_pay?: number;
  price_without_tariff?: number;
  breakdown?: TariffBreakdownItem[];
  error?: string;
}

export interface CartSwapAlternative {
  title: string;
  price: number;
  price_str?: string;
  source?: string;
  link?: string;
  product_link?: string;
  thumbnail?: string;
  tariff_rate?: number;
  tariff_pct?: string;
  tariff_cost?: number;
  country_of_origin?: string;
  price_savings?: number;
  tariff_savings_pct?: number;
  tariff_advantage?: string;
  is_cheaper?: boolean;
  is_lower_tariff?: boolean;
}

export interface CartSwapSuggestion {
  original_item: {
    product_name: string;
    price: number;
    tariff_rate: number;
    tariff_pct: string;
    tariff_you_pay: number;
    country_of_origin: string;
    hts_code: string;
  };
  alternatives: CartSwapAlternative[];
  alternatives_found: number;
  potential_savings: number;
  swap_verdict: string;
}

export interface CartCategoryBreakdown {
  [category: string]: {
    items: number;
    spend: number;
    tariff_cost: number;
  };
}

export interface CartCountryBreakdown {
  [country: string]: {
    items: number;
    spend: number;
    tariff_cost: number;
    avg_tariff_rate: string;
  };
}

export interface CartSummary {
  store: string;
  total_items: number;
  total_cart_price: number;
  total_tariff_cost_raw: number;
  total_tariff_you_pay: number;
  tariff_as_pct_of_cart: string;
  price_without_tariffs: number;
  highest_tariff_item: string | null;
  highest_tariff_rate: string;
  category_breakdown: CartCategoryBreakdown;
  country_breakdown: CartCountryBreakdown;
  potential_savings: number;
  swap_count: number;
  headline: string;
}

export interface CartAnalysisResponse {
  store: string;
  extraction: {
    items_detected: number;
    confidence: string;
    notes: string;
  };
  analyzed_items: CartAnalyzedItem[];
  swap_suggestions: CartSwapSuggestion[];
  summary: CartSummary;
  error?: string;
}
import type { FullPipelineResponse, CartAnalysisResponse } from "@/types/tariff";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function analyzeProduct(query: string, numAlternatives = 4): Promise<FullPipelineResponse> {
  const res = await fetch(`${API_URL}/full-pipeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, use_ai: true, num_alternatives: numAlternatives }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "API request failed" }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }

  return res.json();
}

export async function fetchDashboard(purchases: Array<{ product: string; price: number; country_of_origin?: string }>) {
  const res = await fetch(`${API_URL}/dashboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purchases }),
  });

  if (!res.ok) {
    throw new Error("Dashboard API request failed");
  }

  return res.json();
}

export async function analyzeCart(
  imageData: string,
  mediaType: string = "image/png",
  useAi: boolean = true,
  maxSwapSuggestions: number = 3,
  altsPerSwap: number = 2,
): Promise<CartAnalysisResponse> {
  const res = await fetch(`${API_URL}/cart-analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_data: imageData,
      media_type: mediaType,
      use_ai: useAi,
      max_swap_suggestions: maxSwapSuggestions,
      alts_per_swap: altsPerSwap,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Cart analysis failed" }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }

  return res.json();
}
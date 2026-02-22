import type { StoredPurchase } from "@/types/tariff";

const STORAGE_KEY = "TariffShield_purchases";

export function getPurchases(): StoredPurchase[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addPurchase(purchase: StoredPurchase): void {
  const purchases = getPurchases();
  purchases.push(purchase);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(purchases));
}

export function clearPurchases(): void {
  localStorage.removeItem(STORAGE_KEY);
}

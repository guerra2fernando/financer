// src/lib/constants.ts

export const DEFAULT_BUDGET_CATEGORIES = [
  'food_and_drink',
  'housing',
  'utilities',
  'transportation',
  'clothing',
  'leisure_travel',
  'technology',
  'pets',
  'health_and_wellness',
  'education',
  'entertainment',
  'gifts_and_donations',
  'personal_care',
  'debt_payments',
  'savings_and_investments',
  'miscellaneous',
] as const;

export type ExpenseCategorySlug = typeof DEFAULT_BUDGET_CATEGORIES[number];

export function getDisplayCategoryName(slug: ExpenseCategorySlug): string {
  return slug
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// --- CURRENCY RELATED CONSTANTS ---
// export const AVAILABLE_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'] as const;
// The AVAILABLE_CURRENCIES const array will be derived from the currencies table at runtime if needed for UI dropdowns,
// or can be a hardcoded subset for simplicity if the DB table is the ultimate source of truth.
// For now, let's keep a representative list, but acknowledge it might be dynamic.
// It's good for type safety for CurrencyCode if this list is kept, but ensure it's a SUBSET of what's in the DB.
// Or, use `string` for CurrencyCode and rely on DB validation.
// Given the spec: "CurrencyCode // Ensure CurrencyCode is comprehensive or use string",
// using a string type might be more flexible if the list of currencies is large and dynamic from the DB.
// However, for strong typing with known common currencies, a union is good.
// Let's assume for now we'll manage a core list here and allow `string` for others if necessary,
// or expand this list significantly. For simplicity and to match `DEFAULT_CURRENCY`, keep it as a union for now.

export const COMMON_CURRENCIES_FOR_TYPING = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'BRL', 'GEL'] as const; // Expanded slightly based on spec
export type CurrencyCode = typeof COMMON_CURRENCIES_FOR_TYPING[number] | (string & {}); // Allows known + any string

export const BASE_REPORTING_CURRENCY: CurrencyCode = 'USD'; // As per specification
export const DEFAULT_CURRENCY: CurrencyCode = 'USD'; // Default user preference, can be changed
// --- END OF CURRENCY RELATED CONSTANTS ---
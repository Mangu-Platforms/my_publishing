/**
 * Display formatting for nullable prices (ApiBook.price is number | null).
 * Returns null when there is no price — callers omit the element instead of
 * rendering a dangling "$" — and always two decimals otherwise ("$12.50",
 * never "$12.5").
 */
export function formatPrice(price: number | null | undefined): string | null {
  const value = Number(price);
  if (price == null || Number.isNaN(value)) return null;
  return `$${value.toFixed(2)}`;
}

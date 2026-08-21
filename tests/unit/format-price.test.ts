/** @jest-environment node */

import { formatPrice } from '@/lib/utils/format-price';

describe('formatPrice', () => {
  it('renders two decimals', () => {
    expect(formatPrice(12.5)).toBe('$12.50');
    expect(formatPrice(3)).toBe('$3.00');
    expect(formatPrice(0)).toBe('$0.00');
  });

  it('returns null for missing prices so callers omit the element', () => {
    expect(formatPrice(null)).toBeNull();
    expect(formatPrice(undefined)).toBeNull();
  });

  it('returns null for non-numeric values', () => {
    expect(formatPrice(Number.NaN)).toBeNull();
  });
});

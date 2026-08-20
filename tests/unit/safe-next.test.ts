/** @jest-environment node */

import { sanitizeNextPath } from '@/lib/utils/safe-next';

describe('sanitizeNextPath', () => {
  it('passes same-origin relative paths through', () => {
    expect(sanitizeNextPath('/library')).toBe('/library');
    expect(sanitizeNextPath('/checkout?book_id=abc')).toBe('/checkout?book_id=abc');
  });

  it('falls back to / for empty values', () => {
    expect(sanitizeNextPath(null)).toBe('/');
    expect(sanitizeNextPath(undefined)).toBe('/');
    expect(sanitizeNextPath('')).toBe('/');
  });

  it('rejects absolute URLs', () => {
    expect(sanitizeNextPath('https://evil.example')).toBe('/');
    expect(sanitizeNextPath('http://evil.example/library')).toBe('/');
  });

  it('rejects protocol-relative URLs', () => {
    expect(sanitizeNextPath('//evil.example')).toBe('/');
    expect(sanitizeNextPath('//evil.example/library')).toBe('/');
  });

  it('rejects backslash smuggling', () => {
    expect(sanitizeNextPath('/\\evil.example')).toBe('/');
    expect(sanitizeNextPath('\\/evil.example')).toBe('/');
  });

  it('rejects control-char smuggling that URL parsers strip (tab/CR/LF)', () => {
    // new URL('/\t/evil.example', base) resolves to https://evil.example/
    expect(sanitizeNextPath('/\t/evil.example')).toBe('/');
    expect(sanitizeNextPath('/\n/evil.example')).toBe('/');
    expect(sanitizeNextPath('/\r/evil.example')).toBe('/');
    // Plain spaces are not stripped by URL parsing; only C0 controls are.
    expect(sanitizeNextPath('/my library')).toBe('/my library');
    expect(sanitizeNextPath('/lib\0rary')).toBe('/');
  });

  it('rejects paths not starting with /', () => {
    expect(sanitizeNextPath('library')).toBe('/');
    expect(sanitizeNextPath('javascript:alert(1)')).toBe('/');
  });
});

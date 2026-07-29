import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

/**
 * Task 4.6 — /blog is switched off.
 *
 * There are no posts, and a page that says "first post coming soon" is a
 * promise we have not kept. Until a real post exists this route 404s and the
 * footer link is gone; the sitemap already excludes /blog (P-004).
 *
 * To bring it back: replace this file with a real index that lists real posts.
 */
export const metadata: Metadata = {
  title: 'Not found',
  robots: { index: false, follow: false },
};

export default function BlogPage() {
  notFound();
  // notFound() throws, so this never runs. It is here so the component has a
  // ReactNode return type rather than void.
  return null;
}

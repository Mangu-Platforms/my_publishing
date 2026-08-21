import Link from 'next/link';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/layout/Container';
import { ArrowRight } from 'lucide-react';
import { WebPageJsonLd } from '@/components/seo';
import {
  FeaturedBooksSection,
  TrendingBooksSection,
  GenreExplorer,
  StatsBarSection,
  NewsletterCTA,
  AuthorSpotlight,
  RecommendationsRail,
  BecauseYouReadRail,
} from '@/components/home';
import { getSiteUrl } from '@/lib/seo/siteUrl';
import { isEmailConfigured } from '@/lib/email/send';

export const metadata: Metadata = {
  title: 'Books from MANGU Publishers',
  description: 'Browse the books MANGU Publishers has released and find out where to buy each one.',
  alternates: { canonical: '/' },
};

export default function HomePage() {
  const siteUrl = getSiteUrl();
  const emailEnabled = isEmailConfigured();
  const pageTitle = 'MANGU Publishers';
  // Task 4.6: the old line promised streaming, unlimited reading and video.
  // None of that exists. This describes what the site actually is.
  const pageDescription =
    'Browse the books MANGU Publishers has released and find out where to buy each one.';

  return (
    <div className="relative">
      {/* JSON-LD Structured Data - WebPage */}
      <WebPageJsonLd
        title={pageTitle}
        description={pageDescription}
        url={siteUrl}
        type="WebPage"
        image={`${siteUrl}/og-image.png`}
        breadcrumb={[{ name: 'Home', item: siteUrl }]}
      />

      {/* Background depth layer — giant faded "MANGU" text */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <span className="select-none text-[22vw] font-black leading-none tracking-tighter text-foreground/[0.03] dark:text-foreground/[0.05]">
          MANGU
        </span>
      </div>

      {/* Secondary depth layer — "PUBLISHERS" at bottom */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex justify-center overflow-hidden pb-[10vh]">
        <span className="select-none text-[18vw] font-black leading-none tracking-tighter text-foreground/[0.02] dark:text-foreground/[0.04]">
          PUBLISHERS
        </span>
      </div>

      {/* Hero Section */}
      <section
        className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #533483 100%)',
        }}
      >
        {/* Radial glow effects */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 20% 80%, rgba(255,215,0,0.08) 0%, transparent 40%), radial-gradient(circle at 80% 20%, rgba(138,43,226,0.08) 0%, transparent 40%), radial-gradient(circle at 40% 40%, rgba(0,115,230,0.06) 0%, transparent 40%)',
          }}
        />

        {/* Content */}
        <Container className="relative z-10 py-20">
          <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
            {/* Overline */}
            <p className="mb-6 animate-fade-in text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
              Welcome to
            </p>

            {/* Main Title */}
            <h1
              className="mb-8 text-5xl font-light uppercase leading-[0.9] tracking-[0.15em] sm:text-6xl md:text-7xl lg:text-8xl"
              style={{
                background: 'linear-gradient(45deg, #ffd700, #ff8c00, #ff6b6b)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              MANGU
              <br />
              <span className="text-4xl tracking-[0.2em] sm:text-5xl md:text-6xl lg:text-7xl">
                PUBLISHING
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mb-10 max-w-2xl animate-slide-up text-lg font-light leading-relaxed text-white/85 sm:text-xl">
              The books we publish, and where to buy them. Take your time.
            </p>

            {/* CTA Buttons */}
            <div className="flex animate-slide-up flex-col gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full px-8 py-6 text-base font-semibold shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <Link href="/books">
                  Browse the books
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full border-white/30 bg-white/5 px-8 py-6 text-base font-semibold text-white transition-all duration-300 hover:-translate-y-1 hover:bg-white/10 hover:text-white"
              >
                <Link href="/about">About MANGU</Link>
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* Featured Books Carousel */}
      <FeaturedBooksSection />

      {/* Trending Books Grid */}
      <TrendingBooksSection />

      {/* Resonance Engine rails (Phase 2) — client-side, self-suppressing:
          personalized for signed-in readers, trending/editorial otherwise. */}
      <RecommendationsRail
        title="Recommended for You"
        subtitle="Picked by the Resonance Engine"
        endpoint="/api/resonance/recommend?mode=auto&limit=12"
        railId="home-for-you"
        className="border-b border-border/50 bg-muted/10"
      />
      <BecauseYouReadRail railId="home-because-you-read" />

      {/* Stats Bar */}
      <StatsBarSection />

      {/* Genre Explorer */}
      <GenreExplorer />

      {/* Author Spotlight */}
      <AuthorSpotlight />

      {/* Newsletter CTA */}
      <NewsletterCTA enabled={emailEnabled} />
    </div>
  );
}

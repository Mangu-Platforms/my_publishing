/* eslint-disable */
import Link from 'next/link';
import { Navigation } from './Navigation';
import { MobileNav } from './MobileNav';
import { UserMenu } from './UserMenu';
import { SearchBar } from './SearchBar';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/layout/Container';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/*
        Bypass block (WCAG 2.1 2.4.1, Level A). Every page starts with the
        mobile menu, brand, six nav items, search and the user menu; without
        this a keyboard user tabs through all of it on every navigation.
        Hidden until focused, and z-[60] so it clears the sticky header's z-50.
        Targets the <main> landmark in app/layout.tsx.
      */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <Container>
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <MobileNav />
            <Link
              href="/"
              aria-label="MANGU Publishers home"
              className="text-2xl font-bold text-primary"
            >
              MANGU
            </Link>
            <Navigation />
          </div>
          <div className="flex items-center gap-4">
            <SearchBar />
            <UserMenu />
          </div>
        </div>
      </Container>
    </header>
  );
}

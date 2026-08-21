/* eslint-disable */
'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const genres = [
  'Fiction',
  'Non-Fiction',
  'Science Fiction',
  'Fantasy',
  'Mystery',
  'Romance',
  'Thriller',
  'Horror',
  'Biography',
  'History',
  'Self-Help',
  'Business',
];

const sortOptions = [
  { value: 'published_at', label: 'Newest' },
  { value: 'total_reads', label: 'Most Popular' },
  { value: 'average_rating', label: 'Highest Rated' },
  { value: 'price', label: 'Price: Low to High' },
  { value: 'title', label: 'Title: A-Z' },
];

export function BookFilters() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    },
    []
  );

  const pushWithParams = (params: URLSearchParams) => {
    const query = params.toString();
    router.push(query ? `${pathname ?? ''}?${query}` : (pathname ?? '/'));
  };

  const updateSearchParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page'); // Reset to first page
    pushWithParams(params);
  };

  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row">
      <Input
        aria-label="Search books"
        placeholder="Search books..."
        defaultValue={searchParams?.get('q') || ''}
        onChange={(e) => {
          const value = e.target.value;
          if (searchDebounce.current) clearTimeout(searchDebounce.current);
          // Debounce + replace: typing must not fire an RSC refetch and push a
          // history entry per keystroke. Read the LIVE URL at fire time — the
          // render-time snapshot would drop a genre/sort change made during
          // the debounce window.
          searchDebounce.current = setTimeout(() => {
            const params = new URLSearchParams(window.location.search);
            if (value) {
              params.set('q', value);
            } else {
              params.delete('q');
            }
            params.delete('page');
            const query = params.toString();
            router.replace(query ? `${pathname ?? ''}?${query}` : (pathname ?? '/'));
          }, 300);
        }}
        className="flex-1"
      />
      <Select
        value={searchParams?.get('genre') || 'all'}
        onValueChange={(value) => updateSearchParam('genre', value === 'all' ? '' : value)}
      >
        <SelectTrigger aria-label="Filter by genre" className="w-full sm:w-[180px]">
          <SelectValue placeholder="All Genres" />
        </SelectTrigger>
        <SelectContent>
          {/* Radix SelectItem forbids value="" — 'all' maps to param removal. */}
          <SelectItem value="all">All Genres</SelectItem>
          {genres.map((genre) => (
            <SelectItem key={genre} value={genre}>
              {genre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={searchParams?.get('sort') || 'published_at'}
        onValueChange={(value) => updateSearchParam('sort', value)}
      >
        <SelectTrigger aria-label="Sort books" className="w-full sm:w-[180px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

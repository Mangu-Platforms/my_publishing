/* eslint-disable */
// Phoenix WS2d — accepts both legacy BookWithAuthor and dual-run ApiBook shapes
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

/** Minimal shape required by BookCard — compatible with both Supabase and Mongo ApiBook. */
export interface BookCardBook {
  id: string;
  title: string;
  slug: string;
  cover_url?: string | null;
  price?: number | null;
  discount_price?: number | null;
  /** Supabase shape: average_rating. Mongo/ApiBook shape: avg_rating. Both optional. */
  average_rating?: number;
  avg_rating?: number;
  is_featured?: boolean;
  author?: {
    pen_name?: string | null;
    full_name?: string | null;
    profile?: { full_name?: string | null } | null;
  } | null;
  [key: string]: unknown;
}

interface BookCardProps {
  book: BookCardBook;
  variant?: 'default' | 'compact';
  href?: string;
}

export function BookCard({ book, variant = 'default', href }: BookCardProps) {
  const authorName =
    book.author?.profile?.full_name ||
    book.author?.pen_name ||
    book.author?.full_name ||
    'Unknown Author';
  const bookHref = href ?? `/books/${book.slug}`;
  // Support both Supabase (average_rating) and Mongo/ApiBook (avg_rating) field names
  const displayRating = book.average_rating ?? book.avg_rating;

  if (variant === 'compact') {
    return (
      <Link href={bookHref} className="group block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
          {book.cover_url && (
            <Image
              src={book.cover_url}
              alt={`Cover of ${book.title}`}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            />
          )}
        </div>
        <div className="mt-2">
          <h3 className="line-clamp-1 font-semibold transition-colors group-hover:text-primary">
            {book.title}
          </h3>
          <p className="line-clamp-1 text-sm text-muted-foreground">{authorName}</p>
        </div>
      </Link>
    );
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <Link
        href={bookHref}
        className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Card className="overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/5">
          <div className="relative aspect-[2/3] overflow-hidden bg-muted">
            {book.cover_url && (
              <Image
                src={book.cover_url}
                alt={`Cover of ${book.title}`}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-110"
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
              />
            )}
            {book.is_featured && (
              <Badge className="absolute right-2 top-2 bg-primary">Featured</Badge>
            )}
          </div>
          <CardContent className="p-4">
            <h3 className="mb-1 line-clamp-1 font-semibold transition-colors group-hover:text-primary">
              {book.title}
            </h3>
            <p className="mb-2 line-clamp-1 text-sm text-muted-foreground">{authorName}</p>
            <div className="flex items-center justify-between">
              {displayRating ? (
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400" aria-hidden="true">
                    ★
                  </span>
                  <span className="text-sm">{Number(displayRating).toFixed(1)}</span>
                </div>
              ) : (
                <div />
              )}
              <div className="text-sm font-semibold">
                {book.discount_price ? (
                  <>
                    <span className="mr-2 text-muted-foreground line-through">${book.price}</span>
                    <span className="text-primary">${book.discount_price}</span>
                  </>
                ) : (
                  <span>${book.price}</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

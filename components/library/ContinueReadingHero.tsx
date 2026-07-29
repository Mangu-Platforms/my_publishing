'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { getAuthorName, toProgressPercent, type LibraryItem } from './types';

interface ContinueReadingHeroProps {
  /** The most recently accessed in-progress item. */
  item: LibraryItem;
}

export function ContinueReadingHero({ item }: ContinueReadingHeroProps) {
  const shouldReduceMotion = useReducedMotion();
  const { book } = item;
  const authorName = getAuthorName(book);
  const percent = item.progress ? toProgressPercent(item.progress.currentPosition) : null;

  return (
    <motion.section
      aria-label={`Continue reading ${book.title}`}
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative flex min-h-[52vh] items-end overflow-hidden md:min-h-[58vh]"
    >
      {/* Blurred cover backdrop, darkened and faded into the page canvas. */}
      <div aria-hidden="true" className="absolute inset-0">
        {book.cover_url ? (
          <Image
            src={book.cover_url}
            alt=""
            fill
            priority
            className="scale-125 object-cover blur-2xl"
            sizes="100vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-stone-800 to-stone-900" />
        )}
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#12100e] via-[#12100e]/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#12100e] to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-xl p-8 md:p-12">
        <p className="text-xs font-semibold tracking-[0.25em] text-amber-400/90">
          CONTINUE READING
        </p>
        <h2 className="mt-3 line-clamp-2 text-4xl font-bold text-[#f5f1ea] md:text-6xl">
          {book.title}
        </h2>
        <p className="mt-2 text-lg text-stone-300">{authorName}</p>

        {percent !== null && (
          <div className="mt-5">
            <div
              className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-white/15"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${percent}% complete`}
            >
              <div className="h-full bg-[#f5b942]" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-2 text-sm text-stone-300">{percent}% complete</p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {/* Task 1.7: the reader was a stub, so the CTA opens the product page
              (retailer links) instead of a non-functional reading surface. */}
          <Button asChild className="rounded-full bg-[#e5484d] px-6 text-white hover:bg-[#f2555a]">
            <Link href={`/books/${book.slug}`}>View book &amp; retailers</Link>
          </Button>
        </div>
      </div>
    </motion.section>
  );
}

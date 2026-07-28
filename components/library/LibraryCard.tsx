'use client';

import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils/cn';
import { getAuthorName, toProgressPercent, type LibraryItem } from './types';

interface LibraryCardProps {
  item: LibraryItem;
}

function getInitials(title: string): string {
  const initials = title
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
  return initials || '?';
}

export function LibraryCard({ item }: LibraryCardProps) {
  const { book } = item;
  const authorName = getAuthorName(book);
  const isInProgress = Boolean(item.progress && !item.progress.isFinished);
  const isFinished = Boolean(item.progress?.isFinished);
  const percent = item.progress ? toProgressPercent(item.progress.currentPosition) : null;
  // Task 1.7: MANGU ships no on-site reader, so every card goes to the PDP
  // (retailer links live there). `isInProgress` still drives the progress UI.
  const href = `/books/${book.slug}`;

  const ariaLabel =
    `${book.title} by ${authorName}` +
    (isInProgress && percent !== null ? `, ${percent}% complete` : '') +
    (isFinished ? ', finished' : '');

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="group relative block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5484d] focus-visible:ring-offset-2 focus-visible:ring-offset-[#12100e]"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-stone-800 transition-all duration-300 group-hover:z-10 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-black/60 group-hover:ring-1 group-hover:ring-white/20">
        {book.cover_url ? (
          <Image
            src={book.cover_url}
            alt={`Cover of ${book.title}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 40vw, 220px"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-stone-800 to-stone-900"
          >
            <span className="text-3xl font-bold text-stone-500">{getInitials(book.title)}</span>
          </div>
        )}

        {/* Title/author reveal on hover — keeps rails clean like Netflix rows. */}
        <div
          aria-hidden="true"
          className={cn(
            'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-8 opacity-0 transition-opacity duration-300 group-hover:opacity-100',
            isInProgress && 'pb-8'
          )}
        >
          <p className="line-clamp-2 text-sm font-semibold text-[#f5f1ea]">{book.title}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-stone-400">{authorName}</p>
          {isFinished && <p className="mt-1 text-xs font-medium text-amber-300">Read again</p>}
        </div>

        {/* Persistent progress affordance for in-progress books. */}
        {isInProgress && percent !== null && (
          <div className="absolute inset-x-0 bottom-0 bg-black/45 px-2 pb-1.5 pt-1">
            <div className="flex items-center gap-2">
              <div
                className="h-1 flex-1 overflow-hidden rounded-full bg-white/15"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${percent}% complete`}
              >
                <div className="h-full bg-amber-400" style={{ width: `${percent}%` }} />
              </div>
              <span className="text-[10px] font-medium leading-none text-amber-300">
                {percent}%
              </span>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

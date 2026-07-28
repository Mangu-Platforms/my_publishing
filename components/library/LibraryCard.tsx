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

'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BadgeCheck,
  BookOpen,
  Heart,
  Highlighter,
  StickyNote,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils/cn';
import { HIGHLIGHT_COLOR_CLASSES } from '@/components/reader/highlight-colors';

// ── Serializable shapes passed from the server page ─────────────────────────

export interface HubHighlight {
  id: string;
  book_id: string;
  selected_text: string;
  position: string | null;
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'orange';
  note: string | null;
  created_at: string;
  book: { id: string; title: string; slug: string } | null;
}

export interface HubWishlistItem {
  id: string;
  book_id: string;
  created_at: string;
  book: {
    id: string;
    title: string;
    slug: string;
    cover_url: string | null;
    price: number | null;
    discount_price: number | null;
    author: { id: string; pen_name: string } | null;
  } | null;
}

export interface HubFollowedAuthor {
  id: string;
  author_id: string;
  created_at: string;
  author: {
    id: string;
    pen_name: string;
    photo_url: string | null;
    bio: string | null;
    is_verified: boolean | null;
  } | null;
}

interface ReadersHubTabsProps {
  highlights: HubHighlight[];
  wishlist: HubWishlistItem[];
  follows: HubFollowedAuthor[];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

function formatPrice(value: number | null | undefined): string | null {
  if (value == null) return null;
  return value === 0 ? 'Free' : `$${value.toFixed(2)}`;
}

export function ReadersHubTabs({
  highlights: initialHighlights,
  wishlist: initialWishlist,
  follows: initialFollows,
}: ReadersHubTabsProps) {
  const [highlights, setHighlights] = useState(initialHighlights);
  const [wishlist, setWishlist] = useState(initialWishlist);
  const [follows, setFollows] = useState(initialFollows);
  const [busyId, setBusyId] = useState<string | null>(null);

  const notes = useMemo(
    () => highlights.filter((h) => h.note && h.note.trim().length > 0),
    [highlights]
  );

  const deleteHighlight = async (id: string) => {
    if (busyId) return;
    const previous = highlights;
    setBusyId(id);
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    try {
      const res = await fetch('/api/highlights', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        setHighlights(previous);
        toast.error('Could not delete highlight.');
        return;
      }
      toast.success('Highlight deleted');
    } catch {
      setHighlights(previous);
      toast.error('Could not delete highlight.');
    } finally {
      setBusyId(null);
    }
  };

  const removeFromWishlist = async (bookId: string, rowId: string) => {
    if (busyId) return;
    const previous = wishlist;
    setBusyId(rowId);
    setWishlist((prev) => prev.filter((w) => w.id !== rowId));
    try {
      const res = await fetch(`/api/wishlist?book_id=${encodeURIComponent(bookId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setWishlist(previous);
        toast.error('Could not update wishlist.');
        return;
      }
      toast.success('Removed from wishlist');
    } catch {
      setWishlist(previous);
      toast.error('Could not update wishlist.');
    } finally {
      setBusyId(null);
    }
  };

  const unfollow = async (authorId: string, rowId: string) => {
    if (busyId) return;
    const previous = follows;
    setBusyId(rowId);
    setFollows((prev) => prev.filter((f) => f.id !== rowId));
    try {
      const res = await fetch(`/api/follows?author_id=${encodeURIComponent(authorId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setFollows(previous);
        toast.error('Could not unfollow author.');
        return;
      }
      toast.success('Unfollowed author');
    } catch {
      setFollows(previous);
      toast.error('Could not unfollow author.');
    } finally {
      setBusyId(null);
    }
  };

  // ── Highlights / Notes ─────────────────────────────────────────────────────

  const renderHighlight = (h: HubHighlight, showNote: boolean) => {
    const colors = HIGHLIGHT_COLOR_CLASSES[h.color] ?? HIGHLIGHT_COLOR_CLASSES.yellow;
    return (
      <li key={h.id} className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <span
            className={cn('mt-1 h-3 w-3 flex-shrink-0 rounded-full', colors.dot)}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className={cn('rounded px-1 text-sm leading-relaxed', colors.mark)}>
              &ldquo;{h.selected_text}&rdquo;
            </p>
            {showNote && h.note && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{h.note}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {h.book && (
                <Link
                  href={`/books/${h.book.slug}`}
                  className="flex items-center gap-1 transition-colors hover:text-primary"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span className="max-w-[16rem] truncate">{h.book.title}</span>
                </Link>
              )}
              <span>{formatDate(h.created_at)}</span>
              {/* Task 1.7: "Open in reader" pointed at a stub route. MANGU has
                  no on-site reader, so the highlight keeps its saved position
                  without offering a link that cannot work. */}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteHighlight(h.id)}
            disabled={busyId === h.id}
            title="Delete highlight"
            aria-label="Delete highlight"
            className="text-muted-foreground hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </li>
    );
  };

  const emptyBox = (icon: ReactNode, message: string, cta?: ReactNode) => (
    <div className="rounded-lg border border-dashed border-border py-12 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{message}</p>
      {cta}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Tabs defaultValue="highlights">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
        <TabsTrigger value="highlights" className="flex items-center gap-1.5">
          <Highlighter className="h-4 w-4" />
          Highlights
          <Badge variant="secondary">{highlights.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="notes" className="flex items-center gap-1.5">
          <StickyNote className="h-4 w-4" />
          Notes
          <Badge variant="secondary">{notes.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="wishlist" className="flex items-center gap-1.5">
          <Heart className="h-4 w-4" />
          Wishlist
          <Badge variant="secondary">{wishlist.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="following" className="flex items-center gap-1.5">
          <UserCheck className="h-4 w-4" />
          Following
          <Badge variant="secondary">{follows.length}</Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="highlights" className="mt-6">
        {highlights.length > 0 ? (
          <ul className="space-y-3">{highlights.map((h) => renderHighlight(h, true))}</ul>
        ) : (
          emptyBox(
            <Highlighter className="h-5 w-5 text-muted-foreground" />,
            'No highlights yet — select text while reading to save passages here.',
            <Button asChild variant="outline" size="sm">
              <Link href="/library">Open your library</Link>
            </Button>
          )
        )}
      </TabsContent>

      <TabsContent value="notes" className="mt-6">
        {notes.length > 0 ? (
          <ul className="space-y-3">{notes.map((h) => renderHighlight(h, true))}</ul>
        ) : (
          emptyBox(
            <StickyNote className="h-5 w-5 text-muted-foreground" />,
            'No notes yet — add a note to any highlight while reading.'
          )
        )}
      </TabsContent>

      <TabsContent value="wishlist" className="mt-6">
        {wishlist.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {wishlist.map((item) => {
              const book = item.book;
              if (!book) return null;
              const price = formatPrice(book.discount_price ?? book.price);
              return (
                <li
                  key={item.id}
                  className="group flex gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <Link
                    href={`/books/${book.slug}`}
                    className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded bg-muted"
                  >
                    {book.cover_url ? (
                      <Image
                        src={book.cover_url}
                        alt={`Cover of ${book.title}`}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <BookOpen className="h-6 w-6 text-muted-foreground" />
                      </span>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/books/${book.slug}`}
                      className="transition-colors hover:text-primary"
                    >
                      <h3 className="line-clamp-2 text-sm font-medium">{book.title}</h3>
                    </Link>
                    {book.author?.pen_name && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {book.author.pen_name}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      {price && <span className="text-sm font-semibold">{price}</span>}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromWishlist(item.book_id, item.id)}
                        disabled={busyId === item.id}
                        title="Remove from wishlist"
                        aria-label={`Remove ${book.title} from wishlist`}
                        className="text-muted-foreground hover:text-red-500"
                      >
                        <Heart className="h-4 w-4 fill-current" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          emptyBox(
            <Heart className="h-5 w-5 text-muted-foreground" />,
            'Your wishlist is empty — tap the heart on any book to save it for later.',
            <Button asChild variant="outline" size="sm">
              <Link href="/books">Browse books</Link>
            </Button>
          )
        )}
      </TabsContent>

      <TabsContent value="following" className="mt-6">
        {follows.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {follows.map((row) => {
              const author = row.author;
              if (!author) return null;
              return (
                <li
                  key={row.id}
                  className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
                >
                  <Link
                    href={`/authors/${author.id}`}
                    className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-muted"
                  >
                    {author.photo_url ? (
                      <Image
                        src={author.photo_url}
                        alt={author.pen_name}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
                        {author.pen_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/authors/${author.id}`}
                      className="flex items-center gap-1.5 transition-colors hover:text-primary"
                    >
                      <span className="truncate font-medium">{author.pen_name}</span>
                      {author.is_verified && (
                        <BadgeCheck className="h-4 w-4 flex-shrink-0 text-primary" />
                      )}
                    </Link>
                    {author.bio && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {author.bio}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => unfollow(row.author_id, row.id)}
                    disabled={busyId === row.id}
                  >
                    Unfollow
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          emptyBox(
            <UserCheck className="h-5 w-5 text-muted-foreground" />,
            'Not following any authors yet — follow authors to keep up with new releases.',
            <Button asChild variant="outline" size="sm">
              <Link href="/authors">Discover authors</Link>
            </Button>
          )
        )}
      </TabsContent>
    </Tabs>
  );
}

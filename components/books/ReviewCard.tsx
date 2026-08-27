/* eslint-disable */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Flag,
  MoreVertical,
  Star,
  AlertTriangle,
  User,
  Book,
  BadgeCheck,
  PenLine,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  voteOnReview,
  reportReview,
  replyToReview,
  deleteAuthorReply,
} from '@/lib/actions/reviews';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { StarRating } from './StarRating';
import { toast } from 'sonner';

interface ReviewCardProps {
  review: {
    id: string;
    rating: number;
    title?: string;
    content: string;
    is_spoiler: boolean;
    helpful_count: number;
    verified_purchase?: boolean;
    author_reply?: string | null;
    author_reply_at?: string | null;
    created_at: string;
    updated_at: string;
    user_vote?: boolean | null;
  };
  user: {
    id: string;
    username: string;
    avatar_url?: string;
    full_name?: string;
  };
  book?: {
    id: string;
    title: string;
    cover_url?: string;
  };
  compact?: boolean;
  showBookInfo?: boolean;
  /** True when the viewer is an author of this book and may post a public reply. */
  canReply?: boolean;
  onVoteChange?: () => void;
}

export function ReviewCard({
  review,
  user,
  book,
  compact = false,
  showBookInfo = false,
  canReply = false,
  onVoteChange,
}: ReviewCardProps) {
  const [helpfulCount, setHelpfulCount] = useState(review.helpful_count);
  const [userVote, setUserVote] = useState<boolean | null>(review.user_vote || null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSpoiler, setShowSpoiler] = useState(!review.is_spoiler);
  const [isReported, setIsReported] = useState(false);
  const [authorReply, setAuthorReply] = useState(review.author_reply ?? null);
  const [authorReplyAt, setAuthorReplyAt] = useState(review.author_reply_at ?? null);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyDraft, setReplyDraft] = useState(review.author_reply ?? '');
  const [isReplySubmitting, setIsReplySubmitting] = useState(false);

  const handleVote = async (helpful: boolean) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const newVoteState = userVote === helpful ? null : helpful;

      // Optimistic update
      const delta =
        newVoteState === null
          ? userVote
            ? -1
            : 0 // Removing vote
          : userVote === null
            ? helpful
              ? 1
              : 0
            : helpful
              ? 0
              : -1; // Changing vote

      setHelpfulCount((prev) => Math.max(0, prev + delta));
      setUserVote(newVoteState);

      await voteOnReview(review.id, newVoteState);
      onVoteChange?.();
    } catch (error) {
      toast.error('Failed to submit vote');
      // Revert optimistic update
      setHelpfulCount(review.helpful_count);
      setUserVote(review.user_vote || null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReport = async () => {
    try {
      await reportReview(review.id);
      setIsReported(true);
      toast.success('Review reported for moderation');
    } catch (error) {
      toast.error('Failed to report review');
    }
  };

  const handleReplySubmit = async () => {
    const trimmed = replyDraft.trim();
    if (!trimmed || isReplySubmitting) return;

    setIsReplySubmitting(true);
    try {
      await replyToReview(review.id, trimmed);
      setAuthorReply(trimmed);
      setAuthorReplyAt(new Date().toISOString());
      setShowReplyForm(false);
      toast.success(authorReply ? 'Reply updated' : 'Reply posted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save reply');
    } finally {
      setIsReplySubmitting(false);
    }
  };

  const handleReplyDelete = async () => {
    if (isReplySubmitting) return;

    setIsReplySubmitting(true);
    try {
      await deleteAuthorReply(review.id);
      setAuthorReply(null);
      setAuthorReplyAt(null);
      setReplyDraft('');
      setShowReplyForm(false);
      toast.success('Reply removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove reply');
    } finally {
      setIsReplySubmitting(false);
    }
  };

  const renderUserAvatar = () => (
    <Link href={`/users/${user.id}`} className="flex-shrink-0 transition-opacity hover:opacity-80">
      <div className="relative">
        {user.avatar_url ? (
          <Image
            src={user.avatar_url}
            alt={`Avatar for ${user.full_name || user.username}`}
            width={compact ? 32 : 40}
            height={compact ? 32 : 40}
            className="rounded-full border-2 border-background shadow-sm"
          />
        ) : (
          <div
            className={cn(
              'flex items-center justify-center rounded-full border-2 border-background bg-primary/10 shadow-sm',
              compact ? 'h-8 w-8' : 'h-10 w-10'
            )}
          >
            <User
              className={cn('text-primary', compact ? 'h-4 w-4' : 'h-5 w-5')}
              aria-hidden="true"
            />
          </div>
        )}
      </div>
    </Link>
  );

  const renderBookInfo = () => (
    <Link
      href={`/books/${book?.id}`}
      className="flex items-center gap-2 rounded-lg bg-muted p-2 transition-colors hover:bg-muted/80"
    >
      {book?.cover_url ? (
        <Image
          src={book.cover_url}
          alt={`Cover of ${book.title}`}
          width={40}
          height={60}
          className="rounded object-cover"
        />
      ) : (
        <div className="flex h-12 w-10 items-center justify-center rounded bg-muted">
          <Book className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{book?.title}</p>
        <p className="text-xs text-muted-foreground">Book Review</p>
      </div>
    </Link>
  );

  return (
    <article
      className={cn(
        'rounded-lg border bg-card p-4 transition-all hover:shadow-sm',
        compact ? 'p-3' : 'p-4'
      )}
    >
      {/* Header */}
      <div className="mb-3 flex gap-3">
        {renderUserAvatar()}

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between">
            <div>
              <Link
                href={`/users/${user.id}`}
                className="font-medium text-foreground transition-colors hover:text-primary"
              >
                {user.full_name || user.username}
              </Link>
              {review.verified_purchase && (
                <Badge
                  variant="secondary"
                  className="ml-2 border-green-200 bg-green-50 text-green-700"
                >
                  <BadgeCheck className="mr-1 h-3 w-3" aria-hidden="true" />
                  Verified Purchase
                </Badge>
              )}
              <span className="ml-2 text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
              </span>
              {review.updated_at !== review.created_at && (
                <span className="ml-2 text-xs text-muted-foreground">(edited)</span>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Review actions">
                  <MoreVertical className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleReport} disabled={isReported}>
                  <Flag className="mr-2 h-4 w-4" aria-hidden="true" />
                  {isReported ? 'Reported' : 'Report Review'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <StarRating rating={review.rating} size={compact ? 'sm' : 'md'} />
        </div>
      </div>

      {/* Book info (optional) */}
      {showBookInfo && book && renderBookInfo()}

      {/* Review Title */}
      {review.title && (
        <h3 className="mb-2 text-lg font-semibold text-foreground">{review.title}</h3>
      )}

      {/* Spoiler Warning */}
      {review.is_spoiler && !showSpoiler && (
        <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
          <div className="mb-2 flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Spoiler Alert</span>
          </div>
          <p className="mb-3 text-sm text-yellow-700">
            This review contains spoilers for the book.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSpoiler(true)}
            className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
          >
            Show Review Anyway
          </Button>
        </div>
      )}

      {/* Review Content */}
      <div
        className={cn(
          'prose prose-sm mb-4 max-w-none',
          !showSpoiler && review.is_spoiler && 'select-none blur-sm'
        )}
      >
        <p className="whitespace-pre-wrap text-foreground">{review.content}</p>
      </div>

      {/* Author Reply */}
      {authorReply && (showSpoiler || !review.is_spoiler) && (
        <div className="mb-4 rounded-lg border-l-4 border-primary/40 bg-primary/10 p-3">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
            <PenLine className="h-4 w-4" aria-hidden="true" />
            Response from the author
            {authorReplyAt && (
              <span className="text-xs font-normal text-muted-foreground">
                {formatDistanceToNow(new Date(authorReplyAt), { addSuffix: true })}
              </span>
            )}
          </div>
          <p className="whitespace-pre-wrap text-sm text-foreground">{authorReply}</p>
        </div>
      )}

      {/* Author Reply Form (book author only) */}
      {canReply && showReplyForm && (
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <label
            htmlFor={`reply-${review.id}`}
            className="mb-2 block text-sm font-medium text-foreground"
          >
            {authorReply ? 'Edit your response' : 'Respond to this review'}
          </label>
          <Textarea
            id={`reply-${review.id}`}
            value={replyDraft}
            onChange={(event) => setReplyDraft(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Thank your reader or add context…"
            disabled={isReplySubmitting}
          />
          <div className="mt-2 flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleReplySubmit}
              disabled={isReplySubmitting || !replyDraft.trim()}
            >
              {isReplySubmitting ? 'Saving…' : authorReply ? 'Update Reply' : 'Post Reply'}
            </Button>
            {authorReply && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleReplyDelete}
                disabled={isReplySubmitting}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
                Remove
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowReplyForm(false)}
              disabled={isReplySubmitting}
            >
              Cancel
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">{replyDraft.length}/2000</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleVote(true)}
              disabled={isLoading}
              aria-label="Mark review helpful"
              aria-pressed={userVote === true}
              className={cn('h-8 px-2', userVote === true && 'bg-primary/10 text-primary')}
            >
              <ThumbsUp className="mr-1 h-4 w-4" aria-hidden="true" />
              <span className="font-medium">{helpfulCount}</span>
            </Button>

            {!compact && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleVote(false)}
                disabled={isLoading}
                aria-label="Mark review not helpful"
                aria-pressed={userVote === false}
                className={cn('h-8 px-2', userVote === false && 'bg-muted text-muted-foreground')}
              >
                <ThumbsDown className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>

          {!compact && (
            <Button variant="ghost" size="sm" className="h-8">
              <MessageCircle className="mr-1 h-4 w-4" />
              Comment
            </Button>
          )}

          {canReply && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-primary hover:bg-primary/10 hover:text-primary"
              onClick={() => {
                setReplyDraft(authorReply ?? '');
                setShowReplyForm((prev) => !prev);
              }}
            >
              <PenLine className="mr-1 h-4 w-4" aria-hidden="true" />
              {authorReply ? 'Edit Reply' : 'Reply'}
            </Button>
          )}
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-2">
          {review.is_spoiler && (
            <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-yellow-700">
              Spoiler
            </Badge>
          )}
          {review.helpful_count > 10 && (
            <Badge variant="secondary" className="bg-green-50 text-green-700">
              Helpful
            </Badge>
          )}
        </div>
      </div>
    </article>
  );
}

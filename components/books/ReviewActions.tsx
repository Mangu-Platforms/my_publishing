/* eslint-disable */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Edit, Trash2, MoreVertical, Flag } from 'lucide-react';
import { deleteReview, reportReview } from '@/lib/actions/reviews';
import { toast } from 'sonner';

interface ReviewActionsProps {
  review: {
    id: string;
    user_id: string;
  };
  isOwnReview?: boolean;
  editHref?: string;
}

export function ReviewActions({ review, isOwnReview = false, editHref }: ReviewActionsProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteReview(review.id);
      toast.success('Review deleted successfully');
      window.location.reload();
    } catch (error) {
      toast.error('Failed to delete review');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReport = async () => {
    try {
      await reportReview(review.id);
      toast.success('Review reported for moderation');
    } catch (error) {
      toast.error('Failed to report review');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Review actions">
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isOwnReview ? (
          <>
            {editHref && (
              <DropdownMenuItem asChild>
                <Link href={editHref}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Review
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleDelete} disabled={isDeleting} className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              {isDeleting ? 'Deleting...' : 'Delete Review'}
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onClick={handleReport}>
            <Flag className="mr-2 h-4 w-4" />
            Report Review
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

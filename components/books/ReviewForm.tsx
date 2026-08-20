'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { StarRating } from './StarRating';
import { createReview } from '@/lib/actions/reviews';
import { toast } from 'sonner';

const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  title: z.string().optional(),
  content: z.string().min(10, 'Review must be at least 10 characters'),
  is_spoiler: z.boolean().default(false),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

interface ReviewFormProps {
  bookId: string;
  existingReview?: {
    rating: number;
    title?: string;
    content: string;
    is_spoiler: boolean;
  };
  onClose: () => void;
}

export function ReviewForm({ bookId, existingReview, onClose }: ReviewFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<z.input<typeof reviewSchema>, unknown, z.output<typeof reviewSchema>>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: existingReview?.rating || 5,
      title: existingReview?.title || '',
      content: existingReview?.content || '',
      is_spoiler: existingReview?.is_spoiler || false,
    },
  });

  const rating = watch('rating');
  const isSpoiler = watch('is_spoiler');

  const onSubmit = async (data: ReviewFormData) => {
    setIsSubmitting(true);
    try {
      await createReview({
        book_id: bookId,
        ...data,
        is_public: true,
      });

      toast.success(existingReview ? 'Review updated!' : 'Review posted!');
      onClose();
      window.location.reload(); // Refresh to show new review
    } catch (error) {
      toast.error('Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-6">
        <h3 className="mb-2 text-lg font-semibold">
          {existingReview ? 'Edit Your Review' : 'Write a Review'}
        </h3>
        <p className="text-sm text-muted-foreground">
          Share your thoughts about this book with other readers
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Rating */}
        <div>
          <label className="mb-2 block text-sm font-medium">Rating *</label>
          <StarRating
            rating={rating}
            onRatingChange={(newRating) => setValue('rating', newRating)}
            interactive
          />
          {errors.rating && <p className="mt-1 text-sm text-red-500">{errors.rating.message}</p>}
        </div>

        {/* Title */}
        <div>
          <label htmlFor="title" className="mb-2 block text-sm font-medium">
            Review Title (Optional)
          </label>
          <Input
            id="title"
            {...register('title')}
            placeholder="Summarize your review..."
            maxLength={100}
          />
          {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title.message}</p>}
        </div>

        {/* Content */}
        <div>
          <label htmlFor="content" className="mb-2 block text-sm font-medium">
            Your Review *
          </label>
          <Textarea
            id="content"
            {...register('content')}
            placeholder="What did you think of this book? What worked well? What could be improved?"
            rows={6}
            maxLength={5000}
          />
          <div className="mt-1 flex justify-between">
            {errors.content && <p className="text-sm text-red-500">{errors.content.message}</p>}
            <p className="ml-auto text-sm text-muted-foreground">
              {watch('content')?.length || 0}/5000
            </p>
          </div>
        </div>

        {/* Spoiler Warning */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_spoiler"
            checked={isSpoiler}
            onCheckedChange={(checked: boolean) => setValue('is_spoiler', checked)}
          />
          <label htmlFor="is_spoiler" className="cursor-pointer text-sm text-foreground">
            This review contains spoilers
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : existingReview ? 'Update Review' : 'Post Review'}
          </Button>
        </div>
      </form>
    </div>
  );
}

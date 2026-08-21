'use client';

import { Star } from 'lucide-react';

interface ReviewStatsProps {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
}

export function ReviewStats({ averageRating, totalReviews, ratingDistribution }: ReviewStatsProps) {
  const getPercentage = (count: number) => {
    return totalReviews > 0 ? (count / totalReviews) * 100 : 0;
  };

  const getStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}`}
      />
    ));
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Average Rating */}
      <div className="text-center">
        <div className="mb-2 text-4xl font-bold text-foreground">{averageRating.toFixed(1)}</div>
        <div className="mb-2 flex justify-center">{getStars(Math.round(averageRating))}</div>
        <div className="text-muted-foreground">
          Based on {totalReviews.toLocaleString()} review{totalReviews !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Rating Distribution */}
      <div className="space-y-2">
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = ratingDistribution[rating] || 0;
          const percentage = getPercentage(count);

          return (
            <div key={rating} className="flex items-center gap-3">
              <div className="flex w-12 items-center gap-1">
                <span className="text-sm font-medium">{rating}</span>
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              </div>
              <div className="h-2 flex-1 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-yellow-400 transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="w-8 text-right text-sm text-muted-foreground">{count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

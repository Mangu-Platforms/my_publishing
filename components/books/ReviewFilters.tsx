'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, X } from 'lucide-react';

interface ReviewFiltersProps {
  sortBy: 'recent' | 'helpful' | 'highest' | 'lowest';
  onSortChange: (sort: 'recent' | 'helpful' | 'highest' | 'lowest') => void;
  filterSpoilers?: boolean;
  onFilterSpoilersChange?: (filter: boolean) => void;
  className?: string;
}

export function ReviewFilters({
  sortBy,
  onSortChange,
  filterSpoilers = true,
  onFilterSpoilersChange,
  className,
}: ReviewFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className={className}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sort reviews" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="helpful">Most Helpful</SelectItem>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="highest">Highest Rated</SelectItem>
              <SelectItem value="lowest">Lowest Rated</SelectItem>
            </SelectContent>
          </Select>

          {onFilterSpoilersChange && (
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {showFilters && <X className="ml-2 h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

      {showFilters && onFilterSpoilersChange && (
        <div className="flex items-center gap-4 rounded-lg bg-muted p-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filterSpoilers}
              onChange={(e) => onFilterSpoilersChange(e.target.checked)}
              className="rounded border-border"
            />
            Hide spoiler reviews
          </label>
        </div>
      )}
    </div>
  );
}

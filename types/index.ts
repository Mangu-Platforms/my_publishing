/**
 * Central Types Index
 * Re-exports all type definitions for easy importing
 */

// Export all types
export * from './analytics';
export * from './export';
export * from './revenue';
export * from './upload';
export * from './engine';

// Export webhook types explicitly to avoid conflicts
export type {
  WebhookProvider,
  WebhookStatus,
  WebhookProcessingResult,
  WebhookHandler,
  WebhookMetadata,
  StripeEventType,
  WebhookConfig,
  CheckoutMetadata,
  OrderFromWebhook,
  SignatureVerificationResult,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  calculateRetryDelay,
} from './webhook';

// Export webhook event interface separately
export type { WebhookEvent } from './webhook';

// Export stripe types explicitly
export type { StripeWebhookEvent, CheckoutSessionRequest, CheckoutSessionResponse } from './stripe';

// Export books types with explicit names to avoid conflicts (only non-conflicting types)
export type { BookMetadata, CreateBookInput, UpdateBookInput, BookSearchResult } from './books';

// Re-export BookStats from analytics (more comprehensive)
export type { BookStats as AnalyticsBookStats } from './analytics';

// Database types (Supabase generated - you may need to regenerate these)
export type {
  Database,
  BookWithAuthor,
  BookFull,
  BookWithContent,
  BookStatus,
  UserRole,
  Profile,
  Author,
  Book,
  BookContent,
  Order,
  OrderItem,
  OrderWithItems,
  ManuscriptWithAuthor,
} from './database';

// Phoenix Mongo document types (WS2a) — aliased to avoid clashing with legacy shapes above
export type {
  Profile as MongoProfile,
  Author as MongoAuthor,
  Book as MongoBook,
  BookWithAuthor as MongoBookWithAuthor,
  Order as MongoOrder,
  OrderItem as MongoOrderItem,
  Review as MongoReview,
  ReadingProgress as MongoReadingProgress,
  AuditLog as MongoAuditLog,
  ManguRole,
  MongoPagination,
  PaginatedResult as MongoPaginatedResult,
} from './mongo';

/**
 * Common utility types
 */

// Generic API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    page?: number;
    per_page?: number;
    total?: number;
    total_pages?: number;
  };
}

// Pagination params
export interface PaginationParams {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// Generic list response
export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

/**
 * User types
 */
export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: 'user' | 'author' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface Profile extends User {
  bio?: string;
  website?: string;
  twitter_handle?: string;
  stripe_customer_id?: string;
  stripe_account_id?: string;
  payout_enabled: boolean;
}

/**
 * Author types
 */
export interface Author {
  id: string;
  profile_id: string;
  pen_name: string;
  bio?: string | null;
  is_verified: boolean;
  total_books: number;
  royalty_rate: number;
  photo_url?: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

/**
 * Book types
 */
export type BookStatus = 'draft' | 'published' | 'archived';
export type BookVisibility = 'public' | 'private' | 'unlisted';

export interface Book {
  id: string;
  title: string;
  slug: string;
  description?: string;
  cover_url?: string;
  author_id: string;
  status: BookStatus;
  visibility: BookVisibility;
  price?: number;
  currency?: string;
  amazon_url?: string | null;
  kindle_url?: string | null;
  apple_books_url?: string | null;
  audible_url?: string | null;
  barnes_noble_url?: string | null;
  google_play_books_url?: string | null;
  genre?: string;
  tags?: string[];
  word_count?: number;
  page_count?: number;
  isbn?: string;
  content_type?: 'book' | 'comic' | 'paper';
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BookWithAuthor extends Book {
  author: {
    id: string;
    full_name?: string;
    pen_name?: string;
    profile?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
  trailer_vimeo_id?: string;
  is_featured?: boolean;
  average_rating?: number;
  price?: number;
  discount_price?: number;
}

export interface BookWithStats extends Book {
  stats: {
    views: number;
    purchases: number;
    revenue: number;
    rating?: number;
    review_count?: number;
  };
}

export interface BookFull extends Book {
  author: {
    id: string;
    pen_name?: string;
    profile?: {
      full_name?: string;
      avatar_url?: string;
    };
  };
  content?: {
    audio_url?: string;
    text?: string;
  };
  chapters?: Array<{
    id: string;
    title: string;
    content?: string;
    order: number;
  }>;
  audio_url?: string;
  stats?: BookWithStats['stats'];
  // Additional properties from Book type
  average_rating?: number;
  total_reads?: number;
  review_count?: number;
  download_count?: number;
  price?: number;
  discount_price?: number;
  genre?: string;
  trailer_vimeo_id?: string;
}

/**
 * Order types
 */
export type OrderStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Order {
  id: string;
  user_id: string;
  book_id: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  refund_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderWithBook extends Order {
  book: {
    id: string;
    title: string;
    cover_url?: string;
    author_id: string;
  };
}

/**
 * Review types
 */
export interface Review {
  id: string;
  book_id: string;
  user_id: string;
  rating: number;
  title?: string;
  content?: string;
  helpful_count: number;
  verified_purchase: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Follow types
 */
export interface UserFollow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

/**
 * Notification types
 */
export type NotificationType =
  | 'new_follower'
  | 'new_purchase'
  | 'new_review'
  | 'book_published'
  | 'payout_sent'
  | 'system';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

/**
 * Payout types
 */
export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Payout {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  stripe_transfer_id?: string;
  period_start: string;
  period_end: string;
  created_at: string;
  completed_at?: string;
}

/**
 * Reading Progress types
 */
export interface ReadingProgress {
  id: string;
  user_id: string;
  book_id: string;
  current_position: number;
  is_finished: boolean;
  rating?: number | null;
  finished_at?: string | null;
  last_accessed?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Manuscript types
 */
export type ManuscriptStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'revisions_requested'
  | 'accepted'
  | 'rejected'
  | 'published';

export interface Manuscript {
  id: string;
  author_id: string;
  title: string;
  working_title?: string | null;
  genre: string;
  synopsis?: string | null;
  word_count?: number | null;
  target_audience?: string | null;
  status: ManuscriptStatus;
  current_stage?: string | null;
  editorial_notes?: string | null;
  manuscript_file_url?: string | null;
  sample_chapters_url?: string | null;
  cover_draft_url?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Engagement Event types
 */
export interface EngagementEvent {
  id: string;
  user_id?: string | null;
  book_id: string;
  event_type: string;
  event_value?: Record<string, unknown> | null;
  created_at: string;
}

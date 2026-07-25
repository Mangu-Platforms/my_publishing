/**
 * Database types for MANGU Platform
 * Generated from Supabase schema
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          subscription_tier: SubscriptionTier;
          preferences: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          subscription_tier?: SubscriptionTier;
          preferences?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string;
          full_name?: string | null;
          role?: UserRole;
          subscription_tier?: SubscriptionTier;
          preferences?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      authors: {
        Row: {
          id: string;
          profile_id: string;
          pen_name: string;
          bio: string | null;
          is_verified: boolean;
          total_books: number;
          royalty_rate: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          pen_name: string;
          bio?: string | null;
          is_verified?: boolean;
          total_books?: number;
          royalty_rate?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          pen_name?: string;
          bio?: string | null;
          is_verified?: boolean;
          total_books?: number;
          royalty_rate?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      books: {
        Row: {
          id: string;
          isbn: string | null;
          title: string;
          slug: string;
          description: string | null;
          cover_url: string | null;
          trailer_vimeo_id: string | null;
          genre: string;
          price: number;
          discount_price: number | null;
          status: BookStatus;
          is_featured: boolean;
          total_reads: number;
          average_rating: number;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          isbn?: string | null;
          title: string;
          slug: string;
          description?: string | null;
          cover_url?: string | null;
          trailer_vimeo_id?: string | null;
          genre: string;
          price: number;
          discount_price?: number | null;
          status?: BookStatus;
          is_featured?: boolean;
          total_reads?: number;
          average_rating?: number;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          isbn?: string | null;
          title?: string;
          slug?: string;
          description?: string | null;
          cover_url?: string | null;
          trailer_vimeo_id?: string | null;
          genre?: string;
          price?: number;
          discount_price?: number | null;
          status?: BookStatus;
          is_featured?: boolean;
          total_reads?: number;
          average_rating?: number;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      book_content: {
        Row: {
          id: string;
          book_id: string;
          epub_url: string | null;
          pdf_url: string | null;
          audio_url: string | null;
          toc: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          book_id: string;
          epub_url?: string | null;
          pdf_url?: string | null;
          audio_url?: string | null;
          toc?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          book_id?: string;
          epub_url?: string | null;
          pdf_url?: string | null;
          audio_url?: string | null;
          toc?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      reading_sessions: {
        Row: {
          id: string;
          user_id: string;
          book_id: string;
          duration: number;
          pages_read: number;
          started_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          book_id: string;
          duration?: number;
          pages_read?: number;
          started_at?: string;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          book_id?: string;
          duration?: number;
          pages_read?: number;
          started_at?: string;
          ended_at?: string | null;
        };
      };
      reading_progress: {
        Row: {
          id: string;
          user_id: string;
          book_id: string;
          current_position: number;
          is_finished: boolean;
          rating: number | null;
          finished_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          book_id: string;
          current_position?: number;
          is_finished?: boolean;
          rating?: number | null;
          finished_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          book_id?: string;
          current_position?: number;
          is_finished?: boolean;
          rating?: number | null;
          finished_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      resonance_vectors: {
        Row: {
          id: string;
          book_id: string;
          embedding: string; // pgvector stored as string, parsed to number[]
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          book_id: string;
          embedding: string;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          book_id?: string;
          embedding?: string;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      engagement_events: {
        Row: {
          id: string;
          user_id: string | null;
          book_id: string;
          event_type: string;
          event_value: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          book_id: string;
          event_type: string;
          event_value?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          book_id?: string;
          event_type?: string;
          event_value?: Json | null;
          created_at?: string;
        };
      };
      manuscripts: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          working_title: string | null;
          genre: string;
          synopsis: string | null;
          word_count: number | null;
          target_audience: string | null;
          status: ManuscriptStatus;
          current_stage: string | null;
          editorial_notes: string | null;
          manuscript_file_url: string | null;
          sample_chapters_url: string | null;
          cover_draft_url: string | null;
          book_id: string | null;
          assigned_reviewer_id: string | null;
          converted_by_profile_id: string | null;
          author_notes: string | null;
          internal_notes: string | null;
          version_number: number;
          submitted_at: string | null;
          assigned_at: string | null;
          review_started_at: string | null;
          decision_at: string | null;
          withdrawn_at: string | null;
          converted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          title: string;
          working_title?: string | null;
          genre: string;
          synopsis?: string | null;
          word_count?: number | null;
          target_audience?: string | null;
          status?: ManuscriptStatus;
          current_stage?: string | null;
          editorial_notes?: string | null;
          manuscript_file_url?: string | null;
          sample_chapters_url?: string | null;
          cover_draft_url?: string | null;
          book_id?: string | null;
          assigned_reviewer_id?: string | null;
          converted_by_profile_id?: string | null;
          author_notes?: string | null;
          internal_notes?: string | null;
          version_number?: number;
          submitted_at?: string | null;
          assigned_at?: string | null;
          review_started_at?: string | null;
          decision_at?: string | null;
          withdrawn_at?: string | null;
          converted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          title?: string;
          working_title?: string | null;
          genre?: string;
          synopsis?: string | null;
          word_count?: number | null;
          target_audience?: string | null;
          status?: ManuscriptStatus;
          current_stage?: string | null;
          editorial_notes?: string | null;
          manuscript_file_url?: string | null;
          sample_chapters_url?: string | null;
          cover_draft_url?: string | null;
          book_id?: string | null;
          assigned_reviewer_id?: string | null;
          converted_by_profile_id?: string | null;
          author_notes?: string | null;
          internal_notes?: string | null;
          version_number?: number;
          submitted_at?: string | null;
          assigned_at?: string | null;
          review_started_at?: string | null;
          decision_at?: string | null;
          withdrawn_at?: string | null;
          converted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      manuscript_status_history: {
        Row: {
          id: string;
          manuscript_id: string;
          from_status: ManuscriptStatus | null;
          to_status: ManuscriptStatus;
          changed_by_profile_id: string | null;
          reason: string | null;
          internal_reason: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          manuscript_id: string;
          from_status?: ManuscriptStatus | null;
          to_status: ManuscriptStatus;
          changed_by_profile_id?: string | null;
          reason?: string | null;
          internal_reason?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
      };
      manuscript_reviews: {
        Row: {
          id: string;
          manuscript_id: string;
          reviewer_profile_id: string;
          decision: ManuscriptReviewDecision;
          author_feedback: string | null;
          internal_notes: string | null;
          review_round: number;
          created_at: string;
          updated_at: string;
          submitted_at: string | null;
        };
        Insert: {
          id?: string;
          manuscript_id: string;
          reviewer_profile_id: string;
          decision?: ManuscriptReviewDecision;
          author_feedback?: string | null;
          internal_notes?: string | null;
          review_round?: number;
          created_at?: string;
          updated_at?: string;
          submitted_at?: string | null;
        };
        Update: {
          id?: string;
          decision?: ManuscriptReviewDecision;
          author_feedback?: string | null;
          internal_notes?: string | null;
          submitted_at?: string | null;
        };
      };
      partners: {
        Row: {
          id: string;
          profile_id: string;
          institution_name: string;
          subscription_plan: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          institution_name: string;
          subscription_plan: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          institution_name?: string;
          subscription_plan?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      arc_requests: {
        Row: {
          id: string;
          partner_id: string;
          book_id: string;
          quantity: number;
          status: string;
          requested_at: string;
          fulfilled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          partner_id: string;
          book_id: string;
          quantity: number;
          status?: string;
          requested_at?: string;
          fulfilled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          partner_id?: string;
          book_id?: string;
          quantity?: number;
          status?: string;
          requested_at?: string;
          fulfilled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          user_id: string;
          total_amount: number;
          status: OrderStatus;
          payment_intent_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number: string;
          user_id: string;
          total_amount: number;
          status?: OrderStatus;
          payment_intent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          user_id?: string;
          total_amount?: number;
          status?: OrderStatus;
          payment_intent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          book_id: string;
          unit_price: number;
          license_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          book_id: string;
          unit_price: number;
          license_key?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          book_id?: string;
          unit_price?: number;
          license_key?: string | null;
          created_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_subscription_id: string;
          status: string;
          current_period_end: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_subscription_id: string;
          status: string;
          current_period_end: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_subscription_id?: string;
          status?: string;
          current_period_end?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      book_overview: {
        Row: {
          book_id: string;
          total_reads: number;
          average_rating: number;
          total_reviews: number;
        };
      };
      author_earnings: {
        Row: {
          author_id: string;
          total_earnings: number;
          total_books: number;
        };
      };
      public_profiles: {
        Row: {
          user_id: string;
          name: string | null;
        };
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: UserRole;
      subscription_tier: SubscriptionTier;
      book_status: BookStatus;
      manuscript_status: ManuscriptStatus;
      order_status: OrderStatus;
    };
  };
};

// Enums
export type UserRole = 'reader' | 'author' | 'partner' | 'admin';
export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'institution';
export type BookStatus = 'draft' | 'submitted' | 'review' | 'accepted' | 'published' | 'archived';
export type ManuscriptStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'revisions_requested'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'converted_to_book';

export type ManuscriptReviewDecision = 'pending' | 'changes_requested' | 'accepted' | 'rejected';
export type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

// Composite types
export type Profile = Tables<'profiles'>;
export type Author = Tables<'authors'>;
export type Book = Tables<'books'>;
export type BookContent = Tables<'book_content'>;
export type ReadingSession = Tables<'reading_sessions'>;
export type ReadingProgress = Tables<'reading_progress'>;
export type ResonanceVector = Tables<'resonance_vectors'>;
export type EngagementEvent = Tables<'engagement_events'>;
export type Manuscript = Tables<'manuscripts'>;
export type ManuscriptStatusHistory = Tables<'manuscript_status_history'>;
export type ManuscriptReview = Tables<'manuscript_reviews'>;
export type Partner = Tables<'partners'>;
export type ArcRequest = Tables<'arc_requests'>;
export type Order = Tables<'orders'>;
export type OrderItem = Tables<'order_items'>;
export type Subscription = Tables<'subscriptions'>;

// Extended types with relations
export type BookWithAuthor = Book & {
  author: Author & {
    profile: Profile;
  };
};

export type BookWithContent = Book & {
  content: BookContent | null;
};

export type BookFull = Book & {
  author: Author & {
    profile: Profile;
  };
  content: BookContent | null;
};

export type ManuscriptWithAuthor = Manuscript & {
  author: Author & {
    profile: Profile;
  };
};

export type OrderWithItems = Order & {
  items: (OrderItem & {
    book: Book;
  })[];
};

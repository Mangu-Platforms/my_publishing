import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      // 2026-08-14 (F-10): apiVersion pins a 2023 release. Deliberately NOT
      // bumped in this hardening pass — upgrading changes API/webhook response
      // shapes at runtime. Schedule a dedicated upgrade window: bump the pin,
      // regenerate types, and retest checkout + webhook flows together.
      apiVersion: '2023-10-16',
    });
  }
  return stripeInstance;
}

// Use getStripe() instead of direct stripe export to avoid build-time errors

interface CreateCheckoutSessionParams {
  bookId: string;
  bookSlug?: string;
  /**
   * Supabase auth user id (auth.uid()). Stored in session metadata as
   * `user_id`; the webhook resolves it to profiles.id before writing
   * orders.user_id (which references profiles.id).
   */
  userId: string;
  bookTitle: string;
  price: number;
  /** Origin for success/cancel URLs; falls back to NEXT_PUBLIC_SITE_URL. */
  baseUrl?: string;
  /**
   * ISO 4217 currency code for the line item. Defaults to 'usd' so existing
   * call sites are unchanged. F-10 follow-up (multi-currency): thread the
   * book's stored pricing currency from the checkout route once book data
   * carries one.
   */
  currency?: string;
}

export async function createCheckoutSession({
  bookId,
  bookSlug,
  userId,
  bookTitle,
  price,
  baseUrl,
  currency = 'usd',
}: CreateCheckoutSessionParams) {
  const resolvedBaseUrl = baseUrl || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const stripe = getStripe();
  const bookPath = bookSlug || bookId;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: bookTitle,
          },
          unit_amount: Math.round(price * 100), // Convert to cents
        },
        quantity: 1,
      },
    ],
    success_url: `${resolvedBaseUrl}/books/${bookPath}?success=true`,
    cancel_url: `${resolvedBaseUrl}/books/${bookPath}?canceled=true`,
    metadata: {
      book_id: bookId,
      book_slug: bookSlug || '',
      user_id: userId,
    },
  });

  return session;
}

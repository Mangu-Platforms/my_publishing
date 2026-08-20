import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { fetchPublishedBookForCheckout } from '@/lib/data/books';
import { createCheckoutSession } from '@/lib/stripe/server';
import { formatPrice } from '@/lib/utils/format-price';

interface CheckoutSearchParams {
  book_id?: string;
  slug?: string;
}

/** Checkout URL preserving the book selection, for post-login return trips. */
function checkoutPath(params: CheckoutSearchParams): string {
  const query = new URLSearchParams();
  if (params.book_id) query.set('book_id', params.book_id);
  if (params.slug) query.set('slug', params.slug);
  const qs = query.toString();
  return qs ? `/checkout?${qs}` : '/checkout';
}

async function startCheckout(formData: FormData) {
  'use server';

  const bookId = formData.get('book_id')?.toString() ?? '';
  const bookSlug = formData.get('book_slug')?.toString() ?? '';
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(checkoutPath({ book_id: bookId, slug: bookSlug }))}`
    );
  }

  // Dual-run catalog read (WS2d.1). Auth remains AUTH_PROVIDER until cutover.
  const book = await fetchPublishedBookForCheckout({
    id: bookId || undefined,
    slug: bookSlug || undefined,
  });

  if (!book) {
    throw new Error('Book not found or unavailable for purchase.');
  }

  // Derive origin for Stripe success/cancel URLs from the actual request.
  const headersList = await headers();
  const host = headersList.get('x-forwarded-host') || headersList.get('host');
  const proto = headersList.get('x-forwarded-proto') || 'http';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (host ? `${proto}://${host}` : undefined);

  const session = await createCheckoutSession({
    bookId: book.id,
    bookSlug: book.slug ?? undefined,
    userId: user.id,
    bookTitle: book.title,
    price: book.discount_price || book.price,
    baseUrl,
  });

  if (!session.url) {
    throw new Error('Checkout session missing redirect URL.');
  }

  // redirect() throws internally — keep it outside any try/catch.
  redirect(session.url);
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: CheckoutSearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(checkoutPath(searchParams))}`);
  }

  const book = await fetchPublishedBookForCheckout(searchParams);

  if (!book) {
    notFound();
  }

  const authorName = book.author?.profile?.full_name || book.author?.pen_name || 'Unknown Author';
  const listPrice = formatPrice(book.price);
  // Numeric truthiness on purpose: discount_price 0 means "no discount",
  // mirroring the Stripe charge in startCheckout (discount_price || price).
  const salePrice = book.discount_price ? formatPrice(book.discount_price) : null;
  const payablePrice = formatPrice(book.discount_price || book.price) ?? '—';

  return (
    <Section>
      <Container>
        <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
          <div className="rounded-lg border bg-background p-6 shadow-sm">
            <h1 className="text-3xl font-bold">Checkout</h1>
            <p className="mt-2 text-secondary">
              Review your order before proceeding to secure payment.
            </p>
            <div className="mt-6 flex flex-col gap-6 sm:flex-row">
              <div className="relative h-56 w-40 overflow-hidden rounded-md bg-muted">
                {book.cover_url && (
                  <Image
                    src={book.cover_url}
                    alt={book.title}
                    fill
                    sizes="160px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold">{book.title}</h2>
                <p className="mt-1 text-secondary">by {authorName}</p>
                <div className="mt-4 text-xl font-semibold">
                  {salePrice ? (
                    <>
                      {listPrice && (
                        <span className="mr-2 text-secondary line-through">
                          <span className="sr-only">Original price </span>
                          {listPrice}
                        </span>
                      )}
                      <span className="text-primary">
                        <span className="sr-only">Sale price </span>
                        {salePrice}
                      </span>
                    </>
                  ) : (
                    listPrice && <span>{listPrice}</span>
                  )}
                </div>
                <div className="mt-4 text-sm text-secondary">
                  Need to make changes?{' '}
                  <Link href={`/books/${book.slug ?? book.id}`} className="text-primary underline">
                    View the book
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-background p-6 shadow-sm">
            <h3 className="text-xl font-semibold">Order summary</h3>
            <div className="mt-4 flex items-center justify-between text-sm text-secondary">
              <span>Subtotal</span>
              <span>{payablePrice}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-secondary">
              <span>Taxes</span>
              <span>Calculated at checkout</span>
            </div>
            <div className="mt-6 flex items-center justify-between border-t pt-4 font-semibold">
              <span>Total</span>
              <span>{payablePrice}</span>
            </div>
            <form action={startCheckout} className="mt-6 space-y-2">
              <input type="hidden" name="book_id" value={book.id} />
              <input type="hidden" name="book_slug" value={book.slug ?? ''} />
              <Button type="submit" className="w-full">
                Continue to payment
              </Button>
            </form>
          </div>
        </div>
      </Container>
    </Section>
  );
}

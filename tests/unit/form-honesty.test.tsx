/**
 * Form honesty — component layer (P0-012 contact, P0-013 newsletter), G6 / CCR-006.
 *
 * Complements product-truth.test.ts (which locks the route/action layer).
 * These tests lock the UI invariants:
 *   - no success is ever shown before the backend confirms the side effect;
 *   - failures render real, assistive-tech-announced error states
 *     (role="alert"; success uses role="status", CCR-019);
 *   - when the email provider is not configured, the contact form is replaced
 *     by a working mailto and the newsletter surfaces disappear entirely
 *     (Task 4.6: no form that cannot deliver, and no "coming soon" promise);
 *   - the footer newsletter form posts to the real double opt-in endpoint —
 *     the previous implementation faked a subscription with zero network I/O.
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import { Footer } from '@/components/shared/Footer';
import { NewsletterCTA } from '@/components/home/NewsletterCTA';
import { ContactForm } from '@/app/(consumer)/contact/ContactForm';
import { submitContactMessage } from '@/app/(consumer)/contact/actions';

jest.mock('@/app/(consumer)/contact/actions', () => ({
  submitContactMessage: jest.fn(),
}));

// In production Next.js aliases react-dom to its compiled build, which wires
// <form action={fn}> + useFormState. Raw react-dom 18.3 (what Jest resolves)
// does not. We shim the hook with the same contract so the component's
// state → markup behavior can be exercised; the returned dispatch is exposed
// on globalThis so tests can invoke the form action directly.
jest.mock('react-dom', () => {
  const actual = jest.requireActual('react-dom');
  const React = jest.requireActual('react');
  return {
    ...actual,
    useFormStatus: () => ({ pending: false, data: null, method: null, action: null }),
    useFormState: (
      action: (prev: unknown, formData: FormData) => Promise<unknown>,
      initial: unknown
    ) => {
      const [state, setState] = React.useState(initial);
      const dispatch = (formData: FormData) => {
        void Promise.resolve(action(state, formData)).then((next) => setState(next));
      };
      (globalThis as Record<string, unknown>).__contactFormDispatch = dispatch;
      return [state, dispatch];
    },
  };
});

function dispatchContactForm() {
  const dispatch = (globalThis as Record<string, unknown>).__contactFormDispatch as (
    formData: FormData
  ) => void;
  dispatch(new FormData());
}

const mockedSubmit = submitContactMessage as jest.MockedFunction<typeof submitContactMessage>;
const mockedFetch = () => globalThis.fetch as jest.MockedFunction<typeof fetch>;

beforeAll(() => {
  // jsdom has no IntersectionObserver (framer-motion `whileInView` needs one).
  (globalThis as Record<string, unknown>).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  globalThis.fetch = jest.fn() as unknown as typeof fetch;
  mockedSubmit.mockReset();
});

function mockFetchResponse(response: {
  ok: boolean;
  status?: number;
  body?: Record<string, unknown>;
}) {
  mockedFetch().mockResolvedValueOnce({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: async () => response.body ?? {},
  } as Response);
}

describe('Footer newsletter form (P0-013)', () => {
  it('renders no newsletter band at all when signups are disabled (Task 4.6)', () => {
    render(<Footer newsletterEnabled={false} />);
    expect(screen.queryByRole('button', { name: /subscribe/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email address for newsletter/i)).not.toBeInTheDocument();
    // No promise of a future newsletter either.
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/get an email when we publish/i)).not.toBeInTheDocument();
  });

  it('defaults to the hidden state when the prop is omitted', () => {
    render(<Footer />);
    expect(screen.queryByRole('button', { name: /subscribe/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });

  it('never links to an app store (there are no mobile apps)', () => {
    render(<Footer newsletterEnabled={false} />);
    expect(screen.queryByText(/app store/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/google play/i)).not.toBeInTheDocument();
  });

  it('posts to /api/newsletter and shows the server message only after the backend confirms', async () => {
    let resolveFetch: (value: Response) => void = () => {};
    mockedFetch().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );

    render(<Footer newsletterEnabled />);
    fireEvent.change(screen.getByLabelText(/email address for newsletter/i), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }));

    // While the request is in flight there must be no success claim at all.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        message: 'Check your inbox to confirm your subscription.',
      }),
    } as Response);

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Check your inbox to confirm your subscription.');
    // The old fake copy must never come back.
    expect(screen.queryByText(/thanks for subscribing/i)).not.toBeInTheDocument();

    expect(mockedFetch()).toHaveBeenCalledWith(
      '/api/newsletter',
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse(String(mockedFetch().mock.calls[0][1]?.body));
    expect(body).toEqual({ email: 'reader@example.com' });
  });

  it('renders a real error (role="alert") when the backend fails — never a fake success', async () => {
    mockFetchResponse({
      ok: false,
      status: 502,
      body: { status: 'error', message: 'Could not subscribe right now. Please try again later.' },
    });

    render(<Footer newsletterEnabled />);
    fireEvent.change(screen.getByLabelText(/email address for newsletter/i), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not subscribe right now.');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders a real error on network failure', async () => {
    mockedFetch().mockRejectedValueOnce(new Error('offline'));

    render(<Footer newsletterEnabled />);
    fireEvent.change(screen.getByLabelText(/email address for newsletter/i), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/network error/i);
  });
});

describe('NewsletterCTA (P0-013)', () => {
  it('renders nothing when disabled — no form and no promise (Task 4.6)', () => {
    const { container } = render(<NewsletterCTA enabled={false} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button', { name: /subscribe/i })).not.toBeInTheDocument();
  });

  it('shows the server-provided double opt-in message on success, not a false "subscribed" claim', async () => {
    mockFetchResponse({
      ok: true,
      body: { status: 'success', message: 'Check your inbox to confirm your subscription.' },
    });

    render(<NewsletterCTA enabled />);
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Check your inbox to confirm your subscription.');
    expect(screen.queryByText(/you're subscribed/i)).not.toBeInTheDocument();
  });

  it('renders a real error state when the backend rejects the signup', async () => {
    mockFetchResponse({
      ok: false,
      status: 503,
      body: { status: 'disabled', message: 'Newsletter signups are not available yet.' },
    });

    render(<NewsletterCTA enabled />);
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Newsletter signups are not available yet.');
  });
});

describe('ContactForm (P0-012)', () => {
  it('shows an honest unavailable state with a real mailto address when email is not configured', () => {
    render(<ContactForm enabled={false} fallbackEmail="books@mangu-publishers.com" />);
    expect(screen.getByText(/message form is switched off/i)).toBeInTheDocument();
    const mailto = screen.getByRole('link', { name: 'books@mangu-publishers.com' });
    expect(mailto).toHaveAttribute('href', 'mailto:books@mangu-publishers.com');
    expect(screen.queryByRole('button', { name: /send message/i })).not.toBeInTheDocument();
  });

  it('announces backend failure via role="alert" and never shows success', async () => {
    mockedSubmit.mockResolvedValue({
      status: 'error',
      message:
        'Sorry — we could not send your message just now. Please email us directly at books@mangu-publishers.com.',
    });

    render(<ContactForm enabled />);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    await act(async () => dispatchContactForm());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not send your message/i);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('wires field errors to inputs for assistive tech (aria-invalid / aria-describedby)', async () => {
    mockedSubmit.mockResolvedValue({
      status: 'error',
      message: 'Please fix the highlighted fields.',
      fieldErrors: { email: 'Enter a valid email.' },
    });

    render(<ContactForm enabled />);
    await act(async () => dispatchContactForm());

    await screen.findByRole('alert');
    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    expect(emailInput).toHaveAttribute('aria-describedby', 'email-error');
    expect(document.getElementById('email-error')).toHaveTextContent('Enter a valid email.');
  });

  it('announces success via role="status" only after the server action confirms', async () => {
    let resolveAction: (value: { status: 'success'; message: string }) => void = () => {};
    mockedSubmit.mockImplementation(
      () =>
        new Promise<{ status: 'success'; message: string }>((resolve) => {
          resolveAction = resolve;
        })
    );

    render(<ContactForm enabled />);
    act(() => dispatchContactForm());

    // No success claim while the server action is still in flight.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await act(async () => {
      resolveAction({
        status: 'success',
        message: 'Thanks — your message was sent to our support team. We will follow up by email.',
      });
    });

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/your message was sent/i);
  });
});

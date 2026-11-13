import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { environment } from '../config/environment';

let stripePromise: Promise<Stripe | null> | null = null;

/** Completes 3DS on a PaymentIntent the API already created and confirmed. */
export async function confirmStripeCardAction(clientSecret: string): Promise<string> {
  const stripe = await stripeClient();
  if (!stripe) return 'failed';
  const handled = await nextActionStatus(stripe, clientSecret);
  if (handled) return handled;
  const confirmed = await stripe.confirmCardPayment(clientSecret);
  if (confirmed.error || !confirmed.paymentIntent) return 'failed';
  return confirmed.paymentIntent.status;
}

export function cardActionSettled(status: string): boolean {
  return status === 'succeeded' || status === 'requires_capture' || status === 'processing';
}

async function nextActionStatus(stripe: Stripe, clientSecret: string): Promise<string | null> {
  try {
    const next = await stripe.handleNextAction({ clientSecret });
    if (next.error) return 'failed';
    return next.paymentIntent?.status ?? null;
  } catch {
    return null;
  }
}

async function stripeClient(): Promise<Stripe | null> {
  if (!stripePromise) stripePromise = loadKey().then((key) => (key ? loadStripe(key) : null));
  return stripePromise;
}

async function loadKey(): Promise<string> {
  const response = await fetch(`${environment.apiUrl}/stripe-payments/config`);
  if (!response.ok) return '';
  const body = (await response.json()) as { data?: { publishableKey?: string } };
  return body.data?.publishableKey?.trim() ?? '';
}

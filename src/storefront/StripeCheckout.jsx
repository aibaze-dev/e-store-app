import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js/pure';

export const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
let stripePromise;

// Stripe.js is only loaded when a checkout is actually opened.
export default function StripeCheckout({ clientSecret }) {
  stripePromise ||= loadStripe(stripeKey, { locale: 'es' });
  return <div className="overflow-hidden rounded-xl border bg-card">
    <EmbeddedCheckoutProvider key={clientSecret} stripe={stripePromise} options={{ clientSecret }}><EmbeddedCheckout /></EmbeddedCheckoutProvider>
  </div>;
}

// ─── Checkout API ─────────────────────────────────────────────────────────────

import type {
  CheckoutSession,
  CustomerData,
  PaymentInitiateResponse,
} from './checkout-types';

// Read from Vercel env var (fallback to prod if missing)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.nexflowx.tech/api/v1';

/**
 * Fetch checkout session by transaction ID.
 */
export async function fetchCheckoutSession(txId: string): Promise<CheckoutSession> {
  const res = await fetch(`${API_BASE}/checkout-session/${txId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Session not found (${res.status})`);
  }

  return res.json();
}

/**
 * Auto-save customer data with debounce (called from client).
 */
export async function patchCustomerData(
  txId: string,
  data: CustomerData
): Promise<void> {
  try {
    await fetch(`${API_BASE}/checkout-session/${txId}/customer`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (error) {
    // Silent fail so we don't block UX, but keep signal in console for debugging
    console.warn('[Checkout] Auto-save failed silently:', error);
  }
}

/**
 * Initiate payment — returns provider-specific response.
 *
 * Response shapes:
 *  - SumUp: { provider: "sumup", checkout_id: "abc" }
 *  - Stripe: { provider: "stripe", redirect_url: "https://checkout.stripe.com/..." }
 */
export async function initiatePayment(
  txId: string
): Promise<PaymentInitiateResponse> {
  const res = await fetch(`${API_BASE}/checkout-session/${txId}/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Payment initiation failed (${res.status})`);
  }

  return res.json();
}

/**
 * Confirm a SumUp payment with the backend so webhooks can be dispatched.
 */
export async function confirmSumUpPayment(txId: string, checkoutId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/sumup/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txId, checkoutId }),
  });

  if (!res.ok) {
    throw new Error(`Payment confirmation failed (${res.status})`);
  }
}

/**
 * Dynamically load the SumUp card SDK (v2) and mount the card widget.
 *
 * Ref: https://developer.sumup.com/online-payments/checkouts/card-widget
 *
 * The widget renders inline (headless) inside the given container div.
 * 3D Secure modals are injected automatically by SumUp when required.
 *
 * @param checkoutId  - ID returned by POST /initiate (SumUp checkout session)
 * @param containerId - DOM id of the div that will host the widget (e.g. "sumup-card")
 * @param onSuccess   - Called when payment completes successfully
 * @param onError     - Called on failure or load error
 */
export function mountSumUpCard(
  checkoutId: string,
  containerId: string,
  onSuccess?: () => void,
  onError?: (err: string) => void
): void {
  const mountWidget = () => {
    (window as any).SumUpCard?.mount({
      id: containerId,
      checkoutId,
      onResponse: (type: string, body: any) => {
        if (type === 'success') {
          onSuccess?.();
        } else {
          console.error('[SumUp] Payment error:', body);
          onError?.('O pagamento falhou ou foi rejeitado.');
        }
      },
    });
  };

  // If the SDK script is already loaded in this session, mount immediately
  if ((window as any).SumUpCard) {
    mountWidget();
    return;
  }

  // Load SumUp Card SDK v2 — official production URL
  const script = document.createElement('script');
  script.id = 'sumup-checkout-script';
  script.src = 'https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js';
  script.async = true;
  script.onload = mountWidget;
  script.onerror = () => {
    onError?.('Falha ao comunicar com a rede de pagamentos. Verifique a sua ligação.');
  };

  document.head.appendChild(script);
}

/**
 * Detect buyer's country from IP using free geolocation API.
 * Returns ISO country code (e.g. 'PT', 'DE', 'US') or null.
 */
export async function detectCountryFromIP(): Promise<string | null> {
  try {
    const res = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data: { country_code?: string } = await res.json();
    return data.country_code ?? null;
  } catch {
    // Fallback updated to a free HTTPS endpoint (avoids mixed-content in production)
    try {
      const res = await fetch('https://freeipapi.com/api/json', {
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return null;
      const data: { countryCode?: string } = await res.json();
      return data.countryCode ?? null;
    } catch {
      return null;
    }
  }
}

/**
 * Format currency amount with locale-aware formatting
 */
export function formatCurrency(amount: number, currency: string, locale: string = 'pt-PT'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
}

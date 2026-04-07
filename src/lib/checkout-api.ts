// ─── Checkout API ─────────────────────────────────────────────────────────────

import type {
  CheckoutSession,
  CustomerData,
  PaymentInitiateResponse,
} from './checkout-types';

// 1. Read from Vercel env var (fallback to prod if missing)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.nexflowx.tech/api/v1';

/**
 * Fetch checkout session by transaction ID
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
 * Auto-save customer data with debounce (called from client)
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
    console.warn('Auto-save failed silently:', error);
  }
}

/**
 * Initiate payment — returns provider-specific response
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
 * Detect buyer's country from IP using free geolocation API
 * Returns ISO country code (e.g. 'PT', 'DE', 'US')
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
 * Dynamically load the SumUp checkout script and mount the card widget
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
      onResponse: (type: string) => {
        if (type === 'success') {
          onSuccess?.();
        } else {
          onError?.('Payment failed or was rejected.');
        }
      },
    });
  };

  // If already available, mount immediately
  if ((window as any).SumUpCard) {
    mountWidget();
    return;
  }

  const script = document.createElement('script');
  script.id = 'sumup-checkout-script';
  script.src = 'https://gateway.sumup.com/gateway/ecom/card/v1.2/js/sdk.js';
  script.async = true;
  script.onload = mountWidget;
  script.onerror = () => {
    onError?.('Failed to load payment provider.');
  };

  document.head.appendChild(script);
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

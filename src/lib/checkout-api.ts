// ─── Checkout API ─────────────────────────────────────────────────────────────

import type {
  CheckoutSession,
  CustomerData,
  PaymentInitiateResponse,
} from './checkout-types';

const API_BASE = 'https://api-dev.nexflowx.tech/api/v1';

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
  } catch {
    // Silent fail — don't block the user's typing
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
    // Fallback: try another API
    try {
      const res = await fetch('http://ip-api.com/json/?fields=countryCode', {
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
  // Check if script is already loaded
  if (document.getElementById('sumup-checkout-script')) {
    // Script exists — mount directly
    (window as Record<string, unknown>).SumUpCard?.mount({
      id: checkoutId,
      container: document.getElementById(containerId),
      onResult: (result: { status: string }) => {
        if (result.status === 'SUCCESS') {
          onSuccess?.();
        }
      },
      onError: (err: { message: string }) => {
        onError?.(err.message);
      },
    });
    return;
  }

  const script = document.createElement('script');
  script.id = 'sumup-checkout-script';
  script.src = 'https://gateway.sumup.com/gateway/ecom/checkout/v1/sumup-checkout.js';
  script.async = true;
  script.onload = () => {
    (window as Record<string, unknown>).SumUpCard?.mount({
      id: checkoutId,
      container: document.getElementById(containerId),
      onResult: (result: { status: string }) => {
        if (result.status === 'SUCCESS') {
          onSuccess?.();
        }
      },
      onError: (err: { message: string }) => {
        onError?.(err.message);
      },
    });
  };
  script.onerror = () => {
    onError?.('Failed to load payment provider');
  };
  document.head.appendChild(script);
}

/**
 * Format currency amount with locale-aware formatting
 */
export function formatCurrency(amount: number, currency: string, locale: string = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
}

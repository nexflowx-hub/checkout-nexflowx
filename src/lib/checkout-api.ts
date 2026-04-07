// ─── Checkout API ─────────────────────────────────────────────────────────────

import type {
  CheckoutSession,
  CustomerData,
  PaymentInitiateResponse,
  SumUpMountOptions,
} from './checkout-types';
import { normalizeSession } from './checkout-types';

const API_BASE = 'https://api-dev.nexflowx.tech/api/v1';

/**
 * Fetch checkout session by transaction ID.
 * Normalizes the response to guarantee all required fields are present.
 */
export async function fetchCheckoutSession(txId: string): Promise<CheckoutSession> {
  const res = await fetch(`${API_BASE}/checkout-session/${txId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Session not found (${res.status})`);
  }

  const raw: Record<string, unknown> = await res.json();
  return normalizeSession(raw);
}

/**
 * Auto-save customer data with debounce (called from client).
 * Fails silently — never blocks the user's typing.
 */
export async function patchCustomerData(
  txId: string,
  data: CustomerData
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/checkout-session/${txId}/customer`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
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
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Payment initiation failed (${res.status})`);
  }

  return res.json();
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
 * Ensure the SumUp SDK is loaded, then mount the card widget.
 *
 * Strategy:
 * 1. If `window.SumUpCard` already exists → mount immediately.
 * 2. If `window.__sumupSdkReady` (loaded by /sumup-checkout.js) → mount immediately.
 * 3. Otherwise → register a callback on `window.__sumupCallbacks` that will fire
 *    once the SDK loader finishes. Also listen for the `sumup-sdk-ready` event.
 * 4. Timeout after 15 s to avoid indefinite waiting.
 */
export function mountSumUpCard(
  checkoutId: string,
  containerId: string,
  onSuccess?: () => void,
  onError?: (err: string) => void,
  timeoutMs: number = 15000
): () => void {
  const container = document.getElementById(containerId);
  if (!container) {
    onError?.(`Container #${containerId} not found`);
    return () => {};
  }

  const mountOptions: SumUpMountOptions = {
    id: checkoutId,
    container,
    onResult: (result) => {
      if (result.status === 'SUCCESS') {
        onSuccess?.();
      }
    },
    onError: (err) => {
      onError?.(err.message || 'Payment error');
    },
  };

  // ── Already available ────────────────────────────────────────────────────────
  if (window.SumUpCard) {
    try {
      window.SumUpCard.mount(mountOptions);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Mount error');
    }
    return () => {};
  }

  // ── SDK loading in progress (via /sumup-checkout.js) ─────────────────────────
  let mounted = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  function doMount() {
    if (mounted) return;
    mounted = true;
    if (timeoutId) clearTimeout(timeoutId);

    if (window.SumUpCard) {
      try {
        window.SumUpCard.mount(mountOptions);
      } catch (e) {
        onError?.(e instanceof Error ? e.message : 'Mount error');
      }
    } else {
      onError?.('SumUp SDK loaded but SumUpCard is not available');
    }
  }

  function doError(err: string) {
    if (mounted) return;
    mounted = true;
    if (timeoutId) clearTimeout(timeoutId);
    onError?.(err);
  }

  // Register callback for the SDK loader queue
  if (!window.__sumupCallbacks) window.__sumupCallbacks = [];
  window.__sumupCallbacks.push((err?: Error) => {
    if (err) doError(err.message);
    else doMount();
  });

  // Also listen for the custom event (race-condition safety)
  function onReady() {
    window.removeEventListener('sumup-sdk-ready', onReady);
    window.removeEventListener('sumup-sdk-error', onErrorEvent);
    doMount();
  }
  function onErrorEvent() {
    window.removeEventListener('sumup-sdk-ready', onReady);
    window.removeEventListener('sumup-sdk-error', onErrorEvent);
    doError('Failed to load SumUp payment SDK');
  }

  window.addEventListener('sumup-sdk-ready', onReady);
  window.addEventListener('sumup-sdk-error', onErrorEvent);

  // Timeout fallback
  timeoutId = setTimeout(() => {
    if (mounted) return;
    mounted = true;
    window.removeEventListener('sumup-sdk-ready', onReady);
    window.removeEventListener('sumup-sdk-error', onErrorEvent);
    doError('Payment provider took too long to load. Please try again.');
  }, timeoutMs);

  // Return cleanup function
  return () => {
    if (timeoutId) clearTimeout(timeoutId);
    window.removeEventListener('sumup-sdk-ready', onReady);
    window.removeEventListener('sumup-sdk-error', onErrorEvent);
  };
}

/**
 * Preload the SumUp SDK by loading the local loader script `/sumup-checkout.js`.
 * Call this early (e.g. on page load) so the SDK is ready when the user clicks Pay.
 * Returns a cleanup function to remove the script if needed.
 */
export function preloadSumUpSDK(): void {
  if (window.__sumupSdkLoading || window.SumUpCard) return;

  const script = document.createElement('script');
  script.src = '/sumup-checkout.js';
  script.async = true;
  script.id = 'sumup-loader-script';
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

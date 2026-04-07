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
    console.warn('[Checkout] Auto-save failed silently:', error);
  }
}

/**
 * Initiate payment — returns provider-specific response.
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
 * Poll for a DOM element by id until it appears or timeout.
 * Uses requestAnimationFrame for optimal timing.
 */
function waitForElement(
  elementId: string,
  timeoutMs: number = 3000
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    // Immediate check first
    const existing = document.getElementById(elementId);
    if (existing) {
      requestAnimationFrame(() => resolve(existing));
      return;
    }

    const startTime = Date.now();

    function check() {
      const el = document.getElementById(elementId);
      if (el) {
        requestAnimationFrame(() => resolve(el));
        return;
      }
      if (Date.now() - startTime >= timeoutMs) {
        resolve(null);
        return;
      }
      requestAnimationFrame(check);
    }

    requestAnimationFrame(check);
  });
}

/**
 * Dynamically load the SumUp card SDK (v2) and mount the card widget.
 *
 * Ref: https://developer.sumup.com/online-payments/checkouts/card-widget
 *
 * The widget renders inline (headless) inside the given container div.
 * 3D Secure modals are injected automatically by SumUp when required.
 *
 * This function polls for the container element before mounting, avoiding
 * the "missing DOM element" error when the container hasn't rendered yet.
 *
 * @param checkoutId  - ID returned by POST /initiate (SumUp checkout session)
 * @param containerId - DOM id of the div that will host the widget
 * @param onSuccess   - Called when payment completes successfully
 * @param onError     - Called on failure or load error
 */
export async function mountSumUpCard(
  checkoutId: string,
  containerId: string,
  onSuccess?: () => void,
  onError?: (err: string) => void
): Promise<void> {
  const container = await waitForElement(containerId);

  if (!container) {
    onError?.('Elemento de pagamento não encontrado. Recarregue a página.');
    return;
  }

  const doMount = () => {
    try {
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
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Erro ao montar widget de pagamento.');
    }
  };

  // If the SDK is already loaded, mount immediately
  if ((window as any).SumUpCard) {
    doMount();
    return;
  }

  // Load SumUp Card SDK v2 — official production URL
  return new Promise<void>((resolve) => {
    // Remove any previous SumUp script to avoid duplicates
    const prev = document.getElementById('sumup-checkout-script');
    if (prev) prev.remove();

    const script = document.createElement('script');
    script.id = 'sumup-checkout-script';
    script.src = 'https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js';
    script.async = true;

    script.onload = () => {
      doMount();
      resolve();
    };

    script.onerror = () => {
      onError?.('Falha ao comunicar com a rede de pagamentos. Verifique a sua ligação.');
      resolve();
    };

    document.head.appendChild(script);
  });
}

/**
 * Detect buyer's country from IP using free geolocation API.
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

// ─── Checkout Types ────────────────────────────────────────────────────────────

// ─── Window extensions for SumUp SDK ──────────────────────────────────────────
declare global {
  interface Window {
    SumUpCard?: {
      mount: (options: SumUpMountOptions) => void;
    };
    __sumupSdkLoading?: boolean;
    __sumupSdkReady?: boolean;
    __sumupSdkError?: boolean;
    __sumupCallbacks?: Array<(err?: Error) => void>;
  }
}

export interface SumUpMountOptions {
  id: string;
  container: HTMLElement | null;
  onResult?: (result: { status: string }) => void;
  onError?: (err: { message: string }) => void;
}

export interface CheckoutBranding {
  logo_url?: string;
  primary_color: string;
  accent_color: string;
}

/** Safe accessor for branding fields with fallbacks */
export function safeBranding(branding: Partial<CheckoutBranding> | undefined): CheckoutBranding {
  return {
    logo_url: branding?.logo_url ?? '',
    primary_color: branding?.primary_color ?? '#0a0a0a',
    accent_color: branding?.accent_color ?? '#f5f5f5',
  };
}

export interface CheckoutSession {
  id: string;
  amount: number;
  currency: string;
  merchant_name: string;
  branding: CheckoutBranding;
  allowed_methods: string[];
}

/** Normalize a raw API response into a valid CheckoutSession */
export function normalizeSession(raw: Record<string, unknown>): CheckoutSession {
  return {
    id: String(raw.id ?? ''),
    amount: Number(raw.amount ?? 0),
    currency: String(raw.currency ?? 'EUR'),
    merchant_name: String(raw.merchant_name ?? 'Store'),
    branding: safeBranding(raw.branding as Record<string, unknown> | undefined),
    allowed_methods: Array.isArray(raw.allowed_methods)
      ? raw.allowed_methods.map(String)
      : ['card'],
  };
}

export interface CustomerData {
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  address?: string;
  country?: string;
}

export interface PaymentInitiateResponse {
  provider: 'sumup' | 'stripe';
  checkout_id?: string;
  redirect_url?: string;
}

export interface CheckoutFormState {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address: string;
  country: string;
}

export type CheckoutPhase = 'loading' | 'form' | 'processing' | 'external_payment' | 'error';

// Country list for the select dropdown
export const COUNTRIES = [
  { value: 'PT', label: 'Portugal' },
  { value: 'ES', label: 'Spain' },
  { value: 'FR', label: 'France' },
  { value: 'DE', label: 'Germany' },
  { value: 'IT', label: 'Italy' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'BE', label: 'Belgium' },
  { value: 'AT', label: 'Austria' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'IE', label: 'Ireland' },
  { value: 'SE', label: 'Sweden' },
  { value: 'DK', label: 'Denmark' },
  { value: 'FI', label: 'Finland' },
  { value: 'NO', label: 'Norway' },
  { value: 'PL', label: 'Poland' },
  { value: 'CZ', label: 'Czech Republic' },
  { value: 'RO', label: 'Romania' },
  { value: 'HU', label: 'Hungary' },
  { value: 'GR', label: 'Greece' },
  { value: 'HR', label: 'Croatia' },
  { value: 'BG', label: 'Bulgaria' },
  { value: 'US', label: 'United States' },
  { value: 'BR', label: 'Brazil' },
  { value: 'AO', label: 'Angola' },
  { value: 'MZ', label: 'Mozambique' },
  { value: 'CV', label: 'Cape Verde' },
  { value: 'OTHER', label: 'Other' },
] as const;

// Mock data for preview/demo mode
export const MOCK_SESSION: CheckoutSession = {
  id: 'tx_demo_001',
  amount: 49.99,
  currency: 'EUR',
  merchant_name: 'Walluxe Store',
  branding: {
    logo_url: '/walluxe-logo-nome.png',
    primary_color: '#1a1a2e',
    accent_color: '#f0ebe3',
  },
  allowed_methods: ['card'],
};

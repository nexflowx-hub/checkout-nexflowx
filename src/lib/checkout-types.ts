// ─── Checkout Types ────────────────────────────────────────────────────────────

export interface CheckoutBranding {
  logo_url?: string;
  primary_color: string;
  accent_color: string;
}

export interface CheckoutSession {
  id: string;
  amount: number;
  currency: string;
  merchant_name: string;
  branding: CheckoutBranding;
  allowed_methods: string[];
}

export interface CustomerData {
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  address?: string;
  country?: string;
}

/**
 * Response from POST /initiate — backend v3.0 multi-tenant hybrid.
 *
 * - If SumUp: provider='sumup', checkout_id present
 * - If Stripe: provider='stripe', client_secret present
 */
export interface PaymentInitiateResponse {
  provider: 'sumup' | 'stripe';
  checkout_id?: string;
  client_secret?: string;
}

export interface CheckoutFormState {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address: string;
  country: string;
}

export type CheckoutPhase =
  | 'loading'
  | 'form'
  | 'initiating'       // auto-initiating payment in background
  | 'paying'           // payment zone revealed, user interacting
  | 'processing'       // payment being processed/confirmed
  | 'success'          // payment confirmed
  | 'error';

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

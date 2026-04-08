'use client';

import { useEffect, useRef, useState, useCallback, startTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import {
  Shield,
  Loader2,
  AlertTriangle,
  CreditCard,
  Globe,
  Mail,
  User,
  MapPin,
  Lock,
  ChevronRight,
  Phone,
  Languages,
  CheckCircle2,
  X,
  Sparkles,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { loadStripe as loadStripeSDK } from '@stripe/stripe-js';
import type {
  CheckoutSession,
  CheckoutFormState,
  CheckoutPhase,
  PaymentInitiateResponse,
} from '@/lib/checkout-types';
import { MOCK_SESSION, COUNTRIES } from '@/lib/checkout-types';
import type { CheckoutLocale } from '@/lib/checkout-i18n';
import { t, COUNTRY_TO_LOCALE, CURRENCY_LOCALES } from '@/lib/checkout-i18n';
import {
  fetchCheckoutSession,
  patchCustomerData,
  initiatePayment,
  mountSumUpCard,
  confirmSumUpPayment,
  confirmStripePayment,
  formatCurrency,
  detectCountryFromIP,
} from '@/lib/checkout-api';

// ─── Stripe Promise (lazy) ─────────────────────────────────────────────────────
let stripePromise: Promise<any> | null = null;
function getStripePromise(): Promise<any> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
    stripePromise = key ? loadStripeSDK(key) : Promise.resolve(null);
  }
  return stripePromise;
}

// ─── Email validation ──────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

// ─── Debounce Hook ──────────────────────────────────────────────────────────────
function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): T {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedFn = useCallback(
    function debounced(...args: unknown[]) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => callbackRef.current(...args), delay);
    },
    [delay]
  );

  return debouncedFn as T;
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────────
function CheckoutLoading() {
  return (
    <div className="min-h-[100dvh] bg-gray-50/80">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8 md:py-16">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-8">
          <div className="lg:col-span-3">
            <Skeleton className="mb-4 h-8 w-40" />
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-11 w-full rounded-lg" />
                </div>
              ))}
              <Skeleton className="mt-2 h-12 w-full rounded-xl" />
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <Skeleton className="mb-4 h-5 w-28" />
              <div className="space-y-3">
                <Skeleton className="h-14 w-full rounded-lg" />
                <Separator />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Error State ────────────────────────────────────────────────────────────────
function CheckoutError({
  message,
  onRetry,
  tr,
}: {
  message: string;
  onRetry?: () => void;
  tr: ReturnType<typeof t>;
}) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50/80 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-lg sm:p-8"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-7 w-7 text-red-500" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-gray-900 sm:text-xl">{tr.sessionInvalid}</h2>
        <p className="mb-6 text-sm leading-relaxed text-gray-500">{message}</p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" className="rounded-xl px-6">
            {tr.tryAgain}
          </Button>
        )}
      </motion.div>
    </div>
  );
}

// ─── Processing State ──────────────────────────────────────────────────────────
function PaymentProcessing({
  merchantName,
  tr,
}: {
  merchantName: string;
  tr: ReturnType<typeof t>;
}) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50/80 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center"
      >
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">{tr.confirmingPayment}</h2>
        <p className="text-sm text-gray-500">{tr.redirectingTo} {merchantName}...</p>
        <p className="mt-2 text-xs text-gray-400">{tr.doNotClose}</p>
      </motion.div>
    </div>
  );
}

// ─── Success State (brief flash before redirect) ───────────────────────────────
function PaymentSuccess({ tr }: { tr: ReturnType<typeof t> }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50/80 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50"
        >
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </motion.div>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">Pagamento confirmado!</h2>
        <p className="text-sm text-gray-500">A redirecionar...</p>
      </motion.div>
    </div>
  );
}

// ─── Language Selector ──────────────────────────────────────────────────────────
const AVAILABLE_LOCALES: { value: CheckoutLocale; label: string; flag: string }[] = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'pt', label: 'Português', flag: '🇵🇹' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'it', label: 'Italiano', flag: '🇮🇹' },
];

function LanguageSwitcher({
  locale,
  onChange,
}: {
  locale: CheckoutLocale;
  onChange: (l: CheckoutLocale) => void;
}) {
  const current = AVAILABLE_LOCALES.find((l) => l.value === locale);
  return (
    <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-1 py-1 shadow-sm">
      <Languages className="ml-1 h-3 w-3 text-gray-400" />
      {AVAILABLE_LOCALES.map((l) => (
        <button
          key={l.value}
          onClick={() => onChange(l.value)}
          title={l.label}
          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition-all ${
            l.value === locale
              ? 'bg-gray-900 text-white shadow-sm'
              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
          }`}
        >
          {l.flag}
        </button>
      ))}
      {current && (
        <span className="mr-1 hidden text-[10px] font-medium text-gray-400 sm:inline">
          {current.label}
        </span>
      )}
    </div>
  );
}

// ─── Mobile Order Summary (compact, shown above form) ─────────────────────────
function MobileSummary({
  session,
  brandColor,
  accentColor,
  currencyLocale,
  tr,
}: {
  session: CheckoutSession;
  brandColor: string;
  accentColor: string;
  currencyLocale: string;
  tr: ReturnType<typeof t>;
}) {
  return (
    <div
      className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:hidden"
      style={{ backgroundColor: accentColor }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {session.branding.logo_url ? (
            <img
              src={session.branding.logo_url}
              alt={session.merchant_name}
              className="h-8 w-auto max-w-[100px] object-contain"
            />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
              style={{ backgroundColor: brandColor }}
            >
              {session.merchant_name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-semibold text-gray-900">{session.merchant_name}</span>
        </div>
        <span
          className="text-lg font-bold tracking-tight"
          style={{ color: brandColor }}
        >
          {formatCurrency(session.amount, session.currency, currencyLocale)}
        </span>
      </div>
    </div>
  );
}

// ─── Stripe Payment Form (embedded sub-component) ──────────────────────────────
function StripePaymentForm({
  session,
  brandColor,
  tr,
  onSuccess,
  onError,
}: {
  session: CheckoutSession;
  brandColor: string;
  tr: ReturnType<typeof t>;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    onError('');

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (error) {
        onError(error.message || 'Payment failed.');
        setLoading(false);
        return;
      }

      // Payment succeeded without redirect — confirm with backend
      await confirmStripePayment(session.id);
      onSuccess();
    } catch (err: any) {
      onError(err?.message || tr.paymentFailedMsg);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button
        type="submit"
        disabled={loading || !stripe}
        className="group relative h-12 w-full rounded-xl text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:hover:brightness-100"
        style={{ backgroundColor: brandColor }}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {tr.processing}
          </>
        ) : (
          <>
            <Lock className="h-4 w-4 transition-transform group-hover:scale-110" />
            {tr.confirmPayment} {formatCurrency(session.amount, session.currency, 'pt-PT')}
            <ChevronRight className="ml-auto h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </Button>
    </form>
  );
}

// ─── Main Checkout Page ─────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const txId = searchParams.get('txId') ?? null;

  const [locale, setLocale] = useState<CheckoutLocale>('en');
  const tr = t(locale);

  const [session, setSession] = useState<CheckoutSession | null>(() =>
    txId ? null : MOCK_SESSION
  );
  const [phase, setPhase] = useState<CheckoutPhase>(() => (txId ? 'loading' : 'form'));
  const [form, setForm] = useState<CheckoutFormState>({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    address: '',
    country: '',
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [paymentResponse, setPaymentResponse] = useState<PaymentInitiateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const sumUpInitiatedRef = useRef(false);
  const isMountedRef = useRef(true);

  // ─── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ─── Detect language from IP on mount ────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    detectCountryFromIP().then((countryCode) => {
      if (cancelled || !countryCode) return;
      const detected = COUNTRY_TO_LOCALE[countryCode];
      if (detected) setLocale(detected);
    });
    return () => { cancelled = true; };
  }, []);

  // ─── Fetch session when txId is present ──────────────────────────────────
  useEffect(() => {
    if (!txId) return;
    let cancelled = false;

    fetchCheckoutSession(txId)
      .then((data) => {
        if (!cancelled) {
          setSession(data);
          setPhase('form');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[Checkout] Failed to load session:', err);
          setPhase('error');
          setErrorMsg(
            err instanceof Error
              ? err.message
              : 'This checkout session could not be loaded.'
          );
        }
      });

    return () => { cancelled = true; };
  }, [txId]);

  // ─── Auto-save with debounce ─────────────────────────────────────────────
  const debouncedSave = useDebouncedCallback(
    useCallback(
      (formData: CheckoutFormState, currentSession: CheckoutSession | null) => {
        if (!currentSession || !currentSession.id) return;
        const data: Record<string, string> = {};
        if (formData.customer_name.trim()) data.customer_name = formData.customer_name.trim();
        if (formData.customer_email.trim()) data.customer_email = formData.customer_email.trim();
        if (formData.customer_phone.trim()) data.customer_phone = formData.customer_phone.trim();
        if (formData.address.trim()) data.address = formData.address.trim();
        if (formData.country) data.country = formData.country;
        if (Object.keys(data).length === 0) return;

        setSaving(true);
        patchCustomerData(currentSession.id, data).finally(() => {
          setTimeout(() => setSaving(false), 800);
        });
      },
      []
    ),
    500
  );

  const handleFieldChange = useCallback(
    (field: keyof CheckoutFormState, value: string) => {
      setForm((prev) => {
        const next = { ...prev, [field]: value };
        debouncedSave(next, session);
        return next;
      });
    },
    [debouncedSave, session]
  );

  // ─── Manual initiate payment handler (called by button) ───────────────────
  const isFormValid =
    form.customer_name.trim().length >= 2 &&
    isValidEmail(form.customer_email);

  const handleInitiatePayment = useCallback(async () => {
    if (!isFormValid || !session || !session.id) return;

    setErrorMsg('');
    setIsLoading(true);

    try {
      const result = await initiatePayment(session.id);

      if (!isMountedRef.current) return;

      if (result.provider === 'stripe' && result.client_secret) {
        setPaymentResponse(result);
        setPhase('paying');
        toast.success('Preparado para pagamento com Stripe!');
      } else if (result.provider === 'sumup' && result.checkout_id) {
        setPaymentResponse(result);
        setPhase('paying');
        toast.success('Preparado para pagamento com SumUp!');
      } else {
        setPhase('form');
        setErrorMsg('Unsupported payment provider configuration.');
        toast.error('Configuração de pagamento não suportada.');
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.error('[Checkout] Initiate payment error:', err);
      setPhase('form');
      setErrorMsg(err?.message || tr.paymentFailedMsg);
      toast.error(err?.message || tr.paymentFailedMsg);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [isFormValid, session, tr.paymentFailedMsg]);

  // ─── Handle SumUp card mount (only once when phase is paying + provider is sumup) ──
  useEffect(() => {
    if (
      phase !== 'paying' ||
      !paymentResponse ||
      paymentResponse.provider !== 'sumup' ||
      !paymentResponse.checkout_id ||
      sumUpInitiatedRef.current
    ) return;

    sumUpInitiatedRef.current = true;

    mountSumUpCard(
      paymentResponse.checkout_id!,
      'sumup-card-container',
      async () => {
        if (!isMountedRef.current) return;

        // Payment succeeded — confirm with backend
        try {
          await confirmSumUpPayment(session!.id, paymentResponse.checkout_id!);
          if (!isMountedRef.current) return;
          setPhase('success');
          setTimeout(() => {
            window.location.href = 'https://api.nexflowx.tech/success';
          }, 1500);
        } catch (err) {
          if (!isMountedRef.current) return;
          console.error('[Checkout] Confirmation error:', err);
          setPhase('paying');
          setErrorMsg(tr.paymentConfirmError);
        }
      },
      (err) => {
        if (!isMountedRef.current) return;
        console.error('[Checkout] SumUp error:', err);
        setErrorMsg(err);
      }
    );
  }, [phase, paymentResponse, session, tr.paymentConfirmError]);

  // ─── Stripe payment success callback ────────────────────────────────────
  const handleStripeSuccess = useCallback(() => {
    if (!isMountedRef.current) return;
    setPhase('success');
    setTimeout(() => {
      window.location.href = 'https://api.nexflowx.tech/success';
    }, 1500);
  }, []);

  // ─── Retry from error ───────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setPhase('loading');
    setErrorMsg('');
    if (txId) {
      fetchCheckoutSession(txId)
        .then((data) => { setSession(data); setPhase('form'); })
        .catch(() => {
          setPhase('error');
          setErrorMsg('This checkout session is invalid or has expired.');
        });
    } else {
      setSession(MOCK_SESSION);
      setPhase('form');
    }
  }, [txId]);

  // ─── Dynamic branding ───────────────────────────────────────────────────
  const brandColor = session?.branding?.primary_color ?? '#0a0a0a';
  const accentColor = session?.branding?.accent_color ?? '#f5f5f5';
  const logoUrl = session?.branding?.logo_url ?? '';
  const currencyLocale = CURRENCY_LOCALES[locale] ?? 'en-US';

  // ─── Stripe Elements options ────────────────────────────────────────────
  const clientSecret = paymentResponse?.client_secret ?? null;
  const accentColorVal = session?.branding?.accent_color ?? '#1a1a2e';

  const stripeElementsOptions = clientSecret
    ? {
        clientSecret,
        appearance: {
          theme: 'flat' as const,
          variables: {
            colorPrimary: accentColorVal,
            colorBackground: '#ffffff',
            colorText: '#30313d',
            borderRadius: '8px',
            fontFamily: 'inherit',
          },
        },
      }
    : null;

  // ─── Render by phase ─────────────────────────────────────────────────────
  if (phase === 'loading') return <CheckoutLoading />;
  if (phase === 'error') return <CheckoutError message={errorMsg} onRetry={handleRetry} tr={tr} />;
  if (phase === 'processing') return <PaymentProcessing merchantName={session?.merchant_name ?? ''} tr={tr} />;
  if (phase === 'success') return <PaymentSuccess tr={tr} />;

  if (!session) return null;

  // ─── Shared input styling ───────────────────────────────────────────────
  const inputStyle = { '--tw-ring-color': `${brandColor}40` } as React.CSSProperties;

  return (
    <div
      className="min-h-[100dvh] bg-gray-50/80"
      style={{ '--brand': brandColor, '--brand-accent': accentColor } as React.CSSProperties}
    >
      <div className="mx-auto max-w-5xl px-4 py-5 sm:py-6 md:py-12 lg:py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 flex items-center justify-between gap-3 sm:mb-8 md:mb-10"
        >
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl md:text-3xl">
              {tr.checkout}
            </h1>
            {txId && (
              <p className="mt-0.5 truncate text-xs text-gray-500 sm:text-sm">
                {tr.session}: <span className="font-mono">{txId}</span>
              </p>
            )}
          </div>
          <LanguageSwitcher locale={locale} onChange={setLocale} />
        </motion.div>

        {/* ─── Main Layout: Form + Summary ──────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-8">
          {/* LEFT: Customer Form + Payment Zone */}
          <div className="lg:col-span-3">
            {/* Mobile summary (hidden on desktop) */}
            <MobileSummary
              session={session}
              brandColor={brandColor}
              accentColor={accentColor}
              currencyLocale={currencyLocale}
              tr={tr}
            />

            {/* ─── Customer Data Card ──────────────────────────────────── */}
            <motion.div
              key="form-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 md:p-8"
            >
              <div className="mb-5 flex items-center gap-2.5">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg sm:h-8 sm:w-8"
                  style={{ backgroundColor: brandColor }}
                >
                  <CreditCard className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4" />
                </div>
                <h2 className="text-sm font-semibold text-gray-900 sm:text-base">{tr.paymentDetails}</h2>
              </div>

              <div className="space-y-4 sm:space-y-5">
                {/* Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="flex items-center gap-1.5 text-gray-700">
                    <User className="h-3.5 w-3.5 text-gray-400" />
                    {tr.fullName} <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder={tr.fullNamePlaceholder}
                    value={form.customer_name}
                    onChange={(e) => handleFieldChange('customer_name', e.target.value)}
                    className="h-10 rounded-lg text-sm sm:h-11"
                    style={inputStyle}
                    autoComplete="name"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="flex items-center gap-1.5 text-gray-700">
                    <Mail className="h-3.5 w-3.5 text-gray-400" />
                    {tr.email} <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={tr.emailPlaceholder}
                    value={form.customer_email}
                    onChange={(e) => handleFieldChange('customer_email', e.target.value)}
                    className={`h-10 rounded-lg text-sm sm:h-11 ${
                      form.customer_email && !isValidEmail(form.customer_email)
                        ? 'border-red-300 focus-visible:ring-red-300'
                        : form.customer_email && isValidEmail(form.customer_email)
                        ? 'border-emerald-300 focus-visible:ring-emerald-300'
                        : ''
                    }`}
                    style={inputStyle}
                    autoComplete="email"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="flex items-center gap-1.5 text-gray-700">
                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                    {tr.phone}
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder={tr.phonePlaceholder}
                    value={form.customer_phone}
                    onChange={(e) => handleFieldChange('customer_phone', e.target.value)}
                    className="h-10 rounded-lg text-sm sm:h-11"
                    style={inputStyle}
                    autoComplete="tel"
                  />
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <Label htmlFor="address" className="flex items-center gap-1.5 text-gray-700">
                    <MapPin className="h-3.5 w-3.5 text-gray-400" />
                    {tr.address}
                  </Label>
                  <Input
                    id="address"
                    type="text"
                    placeholder={tr.addressPlaceholder}
                    value={form.address}
                    onChange={(e) => handleFieldChange('address', e.target.value)}
                    className="h-10 rounded-lg text-sm sm:h-11"
                    style={inputStyle}
                    autoComplete="street-address"
                  />
                </div>

                {/* Country */}
                <div className="space-y-1.5">
                  <Label htmlFor="country" className="flex items-center gap-1.5 text-gray-700">
                    <Globe className="h-3.5 w-3.5 text-gray-400" />
                    {tr.country}
                  </Label>
                  <Select
                    value={form.country}
                    onValueChange={(val) => handleFieldChange('country', val)}
                  >
                    <SelectTrigger id="country" className="h-10 w-full rounded-lg text-sm sm:h-11" style={inputStyle}>
                      <SelectValue placeholder={tr.selectCountry} />
                    </SelectTrigger>
                    <SelectContent className="max-h-64 overflow-y-auto">
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Error message */}
                <AnimatePresence>
                  {errorMsg && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="flex-1">{errorMsg}</span>
                      <button onClick={() => setErrorMsg('')} className="shrink-0">
                        <X className="h-4 w-4 text-red-400" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Auto-save indicator */}
                <AnimatePresence>
                  {saving && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-center gap-1.5 text-xs text-gray-400"
                    >
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {tr.saving}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* ─── Manual "Continue to Payment" Button (Opção B) ─────── */}
              <AnimatePresence>
                {phase === 'form' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.3 }}
                    className="mt-6"
                  >
                    <Button
                      onClick={handleInitiatePayment}
                      disabled={!isFormValid || isLoading}
                      className="group relative h-12 w-full rounded-xl text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:hover:brightness-100"
                      style={{ backgroundColor: brandColor }}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {tr.processing}
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4 transition-transform group-hover:scale-110" />
                          Continuar para Pagamento
                          <ChevronRight className="ml-auto h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* ─── Payment Zone (revealed after manual initiate) ─────────── */}
            <AnimatePresence>
              {phase === 'paying' && paymentResponse && (
                <motion.div
                  key="payment-zone"
                  initial={{ opacity: 0, y: 16, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                >
                  {/* Payment zone header */}
                  <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3 sm:px-5 sm:py-4 md:px-8">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.15 }}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 sm:h-8 sm:w-8"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-emerald-500 sm:h-4 sm:w-4" />
                    </motion.div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {formatCurrency(session.amount, session.currency, currencyLocale)}
                      </h3>
                      <p className="text-xs text-gray-400">{tr.paymentReady}</p>
                    </div>
                    {paymentResponse.provider === 'stripe' && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                        {tr.poweredBy} Stripe
                      </span>
                    )}
                    {paymentResponse.provider === 'sumup' && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                        {tr.poweredBy} SumUp
                      </span>
                    )}
                  </div>

                  {/* Payment content */}
                  <div className="px-4 py-4 sm:px-5 sm:py-5 md:px-8 md:py-6">
                    {paymentResponse.provider === 'stripe' && stripeElementsOptions && (
                      <Elements
                        stripe={getStripePromise()}
                        options={stripeElementsOptions}
                      >
                        <StripePaymentForm
                          session={session}
                          brandColor={brandColor}
                          tr={tr}
                          onSuccess={handleStripeSuccess}
                          onError={setErrorMsg}
                        />
                      </Elements>
                    )}

                    {paymentResponse.provider === 'sumup' && (
                      <div>
                        {/* SumUp card container — always rendered in DOM, mountSumUpCard polls for it */}
                        <div
                          id="sumup-card-container"
                          className="min-h-[280px] rounded-xl border border-gray-100 bg-gray-50/50 p-3 sm:min-h-[300px] sm:p-4"
                        />
                        {/* SumUp processing indicator */}
                        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-400">
                          <CreditCard className="h-3.5 w-3.5" />
                          <span>{tr.insertCardData}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Trust badges */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[11px] text-gray-400 sm:mt-4 sm:gap-4 sm:text-xs">
              <div className="flex items-center gap-1"><Shield className="h-3 w-3" /><span>{tr.sslEncrypted}</span></div>
              <div className="flex items-center gap-1"><Lock className="h-3 w-3" /><span>{tr.securePayment}</span></div>
              <div className="flex items-center gap-1"><CreditCard className="h-3 w-3" /><span>{tr.pciCompliant}</span></div>
            </div>
          </div>

          {/* RIGHT: Order Summary (desktop only) */}
          <div className="hidden lg:col-span-2 lg:block">
            <div className="sticky top-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {tr.orderSummary}
              </h3>

              <div
                className="mb-5 flex items-center gap-3 rounded-xl p-3"
                style={{ backgroundColor: accentColor }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt={session.merchant_name} className="h-12 w-auto max-w-[140px] object-contain" />
                ) : (
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
                    style={{ backgroundColor: brandColor }}
                  >
                    {session.merchant_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-900">{session.merchant_name}</p>
                  <p className="text-xs text-gray-500">{tr.secureCheckout}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{tr.transactionId}</span>
                  <span className="font-mono text-xs text-gray-700">{session.id}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{tr.currencyLabel}</span>
                  <span className="font-medium text-gray-700">{session.currency.toUpperCase()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{tr.paymentMethod}</span>
                  <span className="font-medium text-gray-700">
                    {session.allowed_methods.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(', ')}
                  </span>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">{tr.total}</span>
                <span className="text-2xl font-bold tracking-tight" style={{ color: brandColor }}>
                  {formatCurrency(session.amount, session.currency, currencyLocale)}
                </span>
              </div>
            </div>

            <div className="mt-4 text-center">
              <p className="text-[11px] leading-relaxed text-gray-400">{tr.secureHostedCheckout}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

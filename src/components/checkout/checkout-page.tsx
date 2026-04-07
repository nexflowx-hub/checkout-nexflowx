'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
  ArrowLeft,
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
import type {
  CheckoutSession,
  CheckoutFormState,
  CheckoutPhase,
} from '@/lib/checkout-types';
import { MOCK_SESSION, COUNTRIES } from '@/lib/checkout-types';
import type { CheckoutLocale } from '@/lib/checkout-i18n';
import { t, COUNTRY_TO_LOCALE, CURRENCY_LOCALES } from '@/lib/checkout-i18n';
import {
  fetchCheckoutSession,
  patchCustomerData,
  initiatePayment,
  mountSumUpCard,
  formatCurrency,
  detectCountryFromIP,
} from '@/lib/checkout-api';

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
    <div className="min-h-screen bg-gray-50/80">
      <div className="mx-auto max-w-5xl px-4 py-8 md:py-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          {/* Left: Form skeleton */}
          <div className="lg:col-span-3">
            <Skeleton className="mb-6 h-10 w-48" />
            <Skeleton className="mb-8 h-5 w-72" />
            <div className="space-y-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-11 w-full rounded-lg" />
                </div>
              ))}
              <Skeleton className="mt-4 h-12 w-full rounded-xl" />
            </div>
          </div>
          {/* Right: Summary skeleton */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <Skeleton className="mb-4 h-6 w-32" />
              <div className="space-y-4">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Separator />
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <Skeleton className="h-12 w-full rounded-xl" />
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50/80 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-7 w-7 text-red-500" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">{tr.sessionInvalid}</h2>
        <p className="mb-6 text-sm text-gray-500 leading-relaxed">{message}</p>
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50/80 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center"
      >
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-gray-900">{tr.processingPayment}</h2>
        <p className="text-sm text-gray-500">
          {tr.redirectingTo} {merchantName}...
        </p>
        <p className="mt-2 text-xs text-gray-400">{tr.doNotClose}</p>
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
    <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-1 py-1 shadow-sm">
      <Languages className="ml-1 h-3.5 w-3.5 text-gray-400" />
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
        <span className="mr-1 text-[10px] font-medium text-gray-400 lg:hidden">
          {current.label}
        </span>
      )}
    </div>
  );
}

// ─── Main Checkout Page ─────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const txId = searchParams.get('txId') ?? null;

  const [locale, setLocale] = useState<CheckoutLocale>('en');
  const tr = t(locale);

  // Lazy init: demo mode uses mock data directly, no effect needed
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
  const [paying, setPaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ─── Detect language from IP on mount ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    detectCountryFromIP().then((countryCode) => {
      if (cancelled || !countryCode) return;
      const detected = COUNTRY_TO_LOCALE[countryCode];
      if (detected) {
        setLocale(detected);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Fetch session when txId is present ──────────────────────────────────────
  // Note: initial phase is already set to 'loading' in the useState initializer.
  // This effect only runs on mount (txId won't change at runtime).
  useEffect(() => {
    if (!txId) return;

    let cancelled = false;

    fetchCheckoutSession(txId)
      .then((data) => {
        if (!cancelled) {
          // Session loaded successfully — always transition to 'form'
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
              : 'This checkout session could not be loaded. Please check the link or contact the merchant.'
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [txId]);

  // ─── Auto-save with debounce ─────────────────────────────────────────────────
  const debouncedSave = useDebouncedCallback(
    useCallback(
      (formData: CheckoutFormState, currentSession: CheckoutSession | null) => {
        if (!currentSession || !currentSession.id) return;
        // Only save non-empty fields
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

  // ─── Payment initiation ─────────────────────────────────────────────────────
  const handlePay = useCallback(async () => {
    if (!session) return;

    // Validate required fields
    if (!form.customer_name.trim() || !form.customer_email.trim()) {
      return;
    }

    setPaying(true);
    setErrorMsg('');

    try {
      const result = await initiatePayment(session.id);

      if (result.provider === 'sumup' && result.checkout_id) {
        setPhase('external_payment');

        // Small delay to let the container render before mounting
        setTimeout(() => {
          mountSumUpCard(
            result.checkout_id!,
            'sumup-card-container',
            () => {
              setPaying(false);
            },
            (err) => {
              console.error('[Checkout] SumUp mount error:', err);
              setPhase('form');
              setPaying(false);
              setErrorMsg(err);
            }
          );
        }, 150);
      } else if (result.provider === 'stripe' && result.redirect_url) {
        setPhase('processing');
        setTimeout(() => {
          window.location.href = result.redirect_url!;
        }, 800);
      } else {
        setPaying(false);
        setErrorMsg('Unsupported payment provider configuration.');
      }
    } catch (err) {
      console.error('[Checkout] Payment initiation error:', err);
      setPaying(false);
      setErrorMsg(tr.paymentFailedMsg);
    }
  }, [session, form, tr.paymentFailedMsg]);

  // ─── Cancel SumUp payment ───────────────────────────────────────────────────
  const handleCancelPayment = useCallback(() => {
    setPhase('form');
    setPaying(false);
  }, []);

  // ─── Retry from error ───────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setPhase('loading');
    setErrorMsg('');
    if (txId) {
      fetchCheckoutSession(txId)
        .then((data) => {
          setSession(data);
          setPhase('form');
        })
        .catch(() => {
          setPhase('error');
          setErrorMsg('This checkout session is invalid or has expired.');
        });
    } else {
      setSession(MOCK_SESSION);
      setPhase('form');
    }
  }, [txId]);

  // ─── Dynamic branding colors (safe with defaults) ────────────────────────────
  const brandColor = session?.branding?.primary_color ?? '#0a0a0a';
  const accentColor = session?.branding?.accent_color ?? '#f5f5f5';
  const logoUrl = session?.branding?.logo_url ?? '';
  const currencyLocale = CURRENCY_LOCALES[locale] ?? 'en-US';

  // ─── Render by phase ─────────────────────────────────────────────────────────
  if (phase === 'loading') return <CheckoutLoading />;
  if (phase === 'error') return <CheckoutError message={errorMsg} onRetry={handleRetry} tr={tr} />;
  if (phase === 'processing') return <PaymentProcessing merchantName={session?.merchant_name ?? 'merchant'} tr={tr} />;

  if (!session) return null;

  return (
    <div
      className="min-h-screen bg-gray-50/80"
      style={{ '--brand': brandColor, '--brand-accent': accentColor } as React.CSSProperties}
    >
      <div className="mx-auto max-w-5xl px-4 py-6 md:py-12 lg:py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 flex items-start justify-between gap-4 md:mb-10"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
              {tr.checkout}
            </h1>
            {txId && (
              <p className="mt-1 text-sm text-gray-500">
                {tr.session}: <span className="font-mono text-xs">{txId}</span>
              </p>
            )}
          </div>
          <LanguageSwitcher locale={locale} onChange={setLocale} />
        </motion.div>

        {/* Main layout */}
        <AnimatePresence mode="wait">
          {phase === 'external_payment' ? (
            <motion.div
              key="sumup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-10"
            >
              {/* Back button */}
              <button
                onClick={handleCancelPayment}
                className="mb-6 flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                {tr.cancelAndGoBack}
              </button>

              {/* Merchant header */}
              <div className="mb-6 flex items-center gap-3">
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt={session.merchant_name}
                    className="h-8 w-auto object-contain"
                  />
                )}
                <span className="text-sm font-medium text-gray-700">{session.merchant_name}</span>
              </div>

              <h2 className="mb-1 text-lg font-semibold text-gray-900">{tr.completePayment}</h2>
              <p className="mb-6 text-sm text-gray-500">
                {formatCurrency(session.amount, session.currency, currencyLocale)}
              </p>

              {/* SumUp card container */}
              <div
                id="sumup-card-container"
                className="min-h-[300px] rounded-xl border border-gray-100 bg-gray-50 p-4"
              />

              {/* Loading indicator while SumUp loads */}
              {paying && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tr.processing}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="grid grid-cols-1 gap-8 lg:grid-cols-5"
            >
              {/* ─── LEFT: Customer Form ──────────────────────────────────────── */}
              <div className="lg:col-span-3">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-8">
                  <div className="mb-6 flex items-center gap-2.5">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ backgroundColor: brandColor }}
                    >
                      <CreditCard className="h-4 w-4 text-white" />
                    </div>
                    <h2 className="text-base font-semibold text-gray-900">{tr.paymentDetails}</h2>
                  </div>

                  <div className="space-y-5">
                    {/* Name */}
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="flex items-center gap-1.5 text-gray-700">
                        <User className="h-3.5 w-3.5 text-gray-400" />
                        {tr.fullName}
                      </Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder={tr.fullNamePlaceholder}
                        value={form.customer_name}
                        onChange={(e) => handleFieldChange('customer_name', e.target.value)}
                        className="h-11 rounded-lg text-sm transition-shadow focus-visible:ring-[3px]"
                        style={{ '--tw-ring-color': `${brandColor}40` } as React.CSSProperties}
                        autoComplete="name"
                      />
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="flex items-center gap-1.5 text-gray-700">
                        <Mail className="h-3.5 w-3.5 text-gray-400" />
                        {tr.email}
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder={tr.emailPlaceholder}
                        value={form.customer_email}
                        onChange={(e) => handleFieldChange('customer_email', e.target.value)}
                        className="h-11 rounded-lg text-sm transition-shadow focus-visible:ring-[3px]"
                        style={{ '--tw-ring-color': `${brandColor}40` } as React.CSSProperties}
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
                        className="h-11 rounded-lg text-sm transition-shadow focus-visible:ring-[3px]"
                        style={{ '--tw-ring-color': `${brandColor}40` } as React.CSSProperties}
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
                        className="h-11 rounded-lg text-sm transition-shadow focus-visible:ring-[3px]"
                        style={{ '--tw-ring-color': `${brandColor}40` } as React.CSSProperties}
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
                        <SelectTrigger
                          id="country"
                          className="h-11 w-full rounded-lg text-sm transition-shadow focus-visible:ring-[3px]"
                          style={{ '--tw-ring-color': `${brandColor}40` } as React.CSSProperties}
                        >
                          <SelectValue placeholder={tr.selectCountry} />
                        </SelectTrigger>
                        <SelectContent className="max-h-64 overflow-y-auto">
                          {COUNTRIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Error message */}
                    {errorMsg && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                      >
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        {errorMsg}
                      </motion.div>
                    )}

                    {/* Pay Button */}
                    <Button
                      onClick={handlePay}
                      disabled={paying || !form.customer_name.trim() || !form.customer_email.trim()}
                      className="group relative mt-2 h-12 w-full rounded-xl text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:hover:brightness-100"
                      style={{ backgroundColor: brandColor }}
                    >
                      {paying ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {tr.processing}
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4 transition-transform group-hover:scale-110" />
                          {tr.pay} {formatCurrency(session.amount, session.currency, currencyLocale)}
                          <ChevronRight className="ml-auto h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </Button>

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
                </div>

                {/* Trust badges */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400 md:mt-6">
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" />
                    <span>{tr.sslEncrypted}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    <span>{tr.securePayment}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>{tr.pciCompliant}</span>
                  </div>
                </div>
              </div>

              {/* ─── RIGHT: Order Summary ─────────────────────────────────────── */}
              <div className="lg:col-span-2">
                <div className="sticky top-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
                    {tr.orderSummary}
                  </h3>

                  {/* Merchant branding */}
                  <div
                    className="mb-5 flex items-center gap-3 rounded-xl p-3"
                    style={{ backgroundColor: accentColor }}
                  >
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={session.merchant_name}
                        className="h-12 w-auto max-w-[140px] object-contain"
                      />
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

                  {/* Payment details */}
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

                  {/* Total */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">{tr.total}</span>
                    <span
                      className="text-2xl font-bold tracking-tight"
                      style={{ color: brandColor }}
                    >
                      {formatCurrency(session.amount, session.currency, currencyLocale)}
                    </span>
                  </div>
                </div>

                {/* Footer info */}
                <div className="mt-4 text-center">
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
                    {tr.secureHostedCheckout}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

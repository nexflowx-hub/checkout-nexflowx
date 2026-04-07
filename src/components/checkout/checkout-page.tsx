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
  CheckCircle2,
  X,
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
  confirmSumUpPayment,
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

// ─── Processing / Redirecting State ────────────────────────────────────────────
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
        <h2 className="mb-2 text-lg font-semibold text-gray-900">{tr.processingPayment}</h2>
        <p className="text-sm text-gray-500">
          {tr.redirectingTo} {merchantName}...
        </p>
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
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
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

  // ─── Payment initiation ─────────────────────────────────────────────────
  const handlePay = useCallback(async () => {
    if (!session) return;
    if (!form.customer_name.trim() || !form.customer_email.trim()) return;

    setPaying(true);
    setErrorMsg('');

    try {
      const result = await initiatePayment(session.id);

      if (result.provider === 'sumup' && result.checkout_id) {
        setPhase('external_payment');

        // mountSumUpCard now polls for the container element (up to 3s)
        mountSumUpCard(
          result.checkout_id!,
          'sumup-card-container',
          async () => {
            if (!isMountedRef.current) return;

            // Show confirmation step
            setConfirming(true);

            try {
              await confirmSumUpPayment(session.id, result.checkout_id!);

              if (!isMountedRef.current) return;
              setPaying(false);
              setConfirming(false);
              setPhase('success');

              // Brief success flash, then redirect
              setTimeout(() => {
                window.location.href = 'https://api.nexflowx.tech/success';
              }, 1500);
            } catch (err) {
              if (!isMountedRef.current) return;
              console.error('[Checkout] Confirmation error:', err);
              setPaying(false);
              setConfirming(false);
              setPhase('form');
              setErrorMsg('O pagamento foi aceite, mas ocorreu um erro na confirmação.');
            }
          },
          (err) => {
            if (!isMountedRef.current) return;
            console.error('[Checkout] SumUp error:', err);
            setPhase('form');
            setPaying(false);
            setErrorMsg(err);
          }
        );
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

  // ─── Cancel SumUp payment ───────────────────────────────────────────────
  const handleCancelPayment = useCallback(() => {
    setPhase('form');
    setPaying(false);
    setErrorMsg('');
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

        {/* ─── PHASE: SumUp Payment Widget ─────────────────────────────── */}
        {phase === 'external_payment' ? (
          <motion.div
            key="sumup-view"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 md:p-10"
          >
            {/* Top bar: back + merchant */}
            <div className="mb-5 flex items-center justify-between">
              <button
                onClick={handleCancelPayment}
                className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{tr.cancelAndGoBack}</span>
              </button>
              {logoUrl && (
                <img src={logoUrl} alt={session.merchant_name} className="h-6 w-auto object-contain sm:h-8" />
              )}
            </div>

            <h2 className="mb-1 text-lg font-semibold text-gray-900">{tr.completePayment}</h2>
            <p className="mb-5 text-sm text-gray-500">
              {session.merchant_name} — {formatCurrency(session.amount, session.currency, currencyLocale)}
            </p>

            {/* SumUp card container — mountSumUpCard polls for this */}
            <div
              id="sumup-card-container"
              className="min-h-[280px] rounded-xl border border-gray-100 bg-gray-50/50 p-3 sm:min-h-[300px] sm:p-4"
            />

            {/* Loading states */}
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-400">
              {confirming ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>A confirmar pagamento...</span>
                </>
              ) : paying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{tr.processing}</span>
                </>
              ) : null}
            </div>
          </motion.div>
        ) : (
          /* ─── PHASE: Form + Summary ──────────────────────────────────── */
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-8">
            {/* LEFT: Customer Form */}
            <div className="lg:col-span-3">
              {/* Mobile summary (hidden on desktop) */}
              <MobileSummary
                session={session}
                brandColor={brandColor}
                accentColor={accentColor}
                currencyLocale={currencyLocale}
                tr={tr}
              />

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
                      {tr.fullName}
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
                      {tr.email}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={tr.emailPlaceholder}
                      value={form.customer_email}
                      onChange={(e) => handleFieldChange('customer_email', e.target.value)}
                      className="h-10 rounded-lg text-sm sm:h-11"
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
                  {errorMsg && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{errorMsg}</span>
                      <button onClick={() => setErrorMsg('')} className="ml-auto shrink-0">
                        <X className="h-4 w-4 text-red-400" />
                      </button>
                    </motion.div>
                  )}

                  {/* Pay Button */}
                  <Button
                    onClick={handlePay}
                    disabled={paying || !form.customer_name.trim() || !form.customer_email.trim()}
                    className="group relative mt-1 h-12 w-full rounded-xl text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:hover:brightness-100"
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
              </motion.div>

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
        )}
      </div>
    </div>
  );
}

# NeXFlowX — Universal Hosted Checkout

<p align="center">
  <strong>Secure, multi-language checkout solution for any merchant.</strong><br/>
  A centralized payment page that external stores redirect their customers to for secure checkout processing.
</p>

---

## Overview

This application is a **hosted checkout page** (similar to Stripe Checkout) that serves as the central payment interface for multiple external merchants. When a customer is redirected here, the checkout session is loaded from the API, the UI is dynamically branded, and the payment is processed through the appropriate provider (SumUp, Stripe, etc.).

### Key Features

- **Dynamic Branding** — Merchant logos, colors, and styles loaded from the API
- **Multi-language (i18n)** — 6 languages: English, Portuguese, Spanish, French, German, Italian
- **Auto-detect language by IP** — Geolocation-based locale detection on page load
- **Auto-save with debounce** — Customer data saved to the API without blocking the UI (500ms debounce)
- **Dual payment provider** — SumUp (embedded card widget) and Stripe (redirect)
- **Mobile-first responsive design** — Stripe-style split layout adapting to all screen sizes
- **Robust UX states** — Loading skeleton, Error with retry, Processing, and External payment phases

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router, Server Components) |
| **Language** | TypeScript 5 (strict) |
| **Styling** | Tailwind CSS 4 + shadcn/ui (New York style) |
| **Icons** | Lucide React |
| **Animations** | Framer Motion 12 |
| **Package Manager** | Bun |
| **Runtime** | Node.js / Bun |

---

## Architecture

```
src/
├── app/
│   ├── layout.tsx          # Root layout with metadata & fonts
│   ├── page.tsx            # Entry point (Suspense wrapper → CheckoutPage)
│   └── globals.css         # Tailwind + custom scrollbar + SumUp overrides
│
├── components/
│   ├── checkout/
│   │   └── checkout-page.tsx   # Main checkout component (all UI logic)
│   └── ui/                      # shadcn/ui component library (30+ components)
│
├── lib/
│   ├── checkout-api.ts      # API layer (fetch, PATCH, POST, IP detect, SumUp mount)
│   ├── checkout-i18n.ts     # i18n translations (6 languages) + country→locale map
│   ├── checkout-types.ts    # TypeScript interfaces, types, COUNTRIES list, mock data
│   ├── db.ts                # Prisma client (available but unused in checkout)
│   └── utils.ts             # Utility functions (cn, etc.)
│
└── public/
    └── walluxe-logo-nome.png   # Default merchant logo (demo mode)
```

---

## API Integration

### Base URL
```
https://api-dev.nexflowx.tech/api/v1
```

### Endpoints Used

#### 1. Fetch Checkout Session
```
GET /checkout-session/{txId}
```
**Response:**
```json
{
  "id": "tx_123",
  "amount": 49.99,
  "currency": "EUR",
  "merchant_name": "Walluxe Store",
  "branding": {
    "logo_url": "https://example.com/logo.png",
    "primary_color": "#1a1a2e",
    "accent_color": "#f0ebe3"
  },
  "allowed_methods": ["card"]
}
```

#### 2. Auto-save Customer Data (PATCH)
```
PATCH /checkout-session/{txId}/customer
Content-Type: application/json
```
**Body:**
```json
{
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "customer_phone": "+351 912 345 678",
  "address": "123 Main Street",
  "country": "PT"
}
```
Called with 500ms debounce on every form field change. Fails silently to avoid blocking the user.

#### 3. Initiate Payment (POST)
```
POST /checkout-session/{txId}/initiate
```
**Response (SumUp):**
```json
{
  "provider": "sumup",
  "checkout_id": "sumup_checkout_abc123"
}
```
**Response (Stripe):**
```json
{
  "provider": "stripe",
  "redirect_url": "https://checkout.stripe.com/pay/..."
}
```

### Geolocation API (IP Detection)
- **Primary:** `https://ipapi.co/json/` (4s timeout)
- **Fallback:** `http://ip-api.com/json/?fields=countryCode` (4s timeout)
- Maps country code to locale using `COUNTRY_TO_LOCALE` dictionary

---

## Payment Flow

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Merchant    │────>│  NeXFlowX API    │────>│  Checkout Page   │
│  (Store)     │     │  (Create Session)│     │  (This App)      │
└─────────────┘     └──────────────────┘     └────────┬─────────┘
                                                       │
                                              ┌────────▼─────────┐
                                              │  Customer Fills  │
                                              │  Form + Auto-save│
                                              │  (PATCH /customer)│
                                              └────────┬─────────┘
                                                       │
                                              ┌────────▼─────────┐
                                              │  Click "Pay"     │
                                              │  (POST /initiate)│
                                              └────────┬─────────┘
                                                       │
                                          ┌────────────┴────────────┐
                                          │                         │
                                 ┌────────▼────────┐      ┌────────▼────────┐
                                 │  SumUp Provider │      │  Stripe Provider│
                                 │  (Embed Widget) │      │  (Redirect)     │
                                 └────────┬────────┘      └────────┬────────┘
                                          │                         │
                                 ┌────────▼──────────────────────▼────────┐
                                 │          Payment Complete            │
                                 └──────────────────────────────────────┘
```

---

## i18n — Internationalization

### Supported Languages

| Code | Language | Countries (auto-detect) |
|------|----------|------------------------|
| `en` | English | GB, US, IE, AU, CA, NZ, and others |
| `pt` | Português | PT, BR, AO, MZ, CV, TL, GW, ST |
| `es` | Español | ES, MX, AR, CO, CL, PE, EC, VE, and others |
| `fr` | Français | FR, BE, LU, MC, SN, CI, and others |
| `de` | Deutsch | DE, AT, CH, LI |
| `it` | Italiano | IT, SM, VA |

### Language Detection Flow

1. On page mount → `detectCountryFromIP()` fetches buyer's country from IP
2. `COUNTRY_TO_LOCALE` maps country code → locale
3. All UI labels, placeholders, and messages are translated via `t(locale)`
4. User can manually override via the language flag selector (top-right corner)
5. Currency formatting adapts to locale (e.g., `49,99 €` in PT vs `€49.99` in EN)

### Adding a New Language

1. Add a new entry to `CheckoutLocale` type in `checkout-i18n.ts`
2. Create the translation object following the `CheckoutTranslations` interface
3. Register it in the `TRANSLATIONS` record
4. Add the flag + label to `AVAILABLE_LOCALES` in `checkout-page.tsx`
5. Add country mappings in `COUNTRY_TO_LOCALE` and `CURRENCY_LOCALES`

---

## Data Collected

| Field | Type | Required | Auto-saved | Description |
|-------|------|----------|------------|-------------|
| `customer_name` | string | Yes | Yes | Full name of the buyer |
| `customer_email` | string | Yes | Yes | Email address |
| `customer_phone` | string | No | Yes | Phone number with country code |
| `address` | string | No | Yes | Street address |
| `country` | string | No | Yes | ISO country code (PT, ES, FR...) |

---

## UX Phases

| Phase | Description | UI |
|-------|-------------|-----|
| `loading` | Initial session fetch | Skeleton placeholders (form + summary) |
| `form` | Main checkout form | Split layout with form + order summary |
| `processing` | Redirecting to Stripe | Full-screen spinner with merchant name |
| `external_payment` | SumUp card widget embedded | Centered card container, hide form |
| `error` | Invalid/expired session | Error card with retry button |

---

## Dynamic Branding

The checkout page adapts its visual identity based on the API response:

- **`primary_color`** → Pay button background, input focus rings, trust badge icons
- **`accent_color`** → Order summary merchant card background
- **`logo_url`** → Displayed in order summary and SumUp payment view
- **`merchant_name`** → Shown in header, summary, and processing state

---

## How to Run

### Prerequisites
- Node.js 18+ or Bun 1+
- npm or bun package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/nexflowx-hub/checkout-nexflowx.git
cd checkout-nexflowx

# Install dependencies
bun install

# Start development server
bun run dev
```

The app will be available at `http://localhost:3000`.

### Modes

- **Demo mode** — Access `/` to see the checkout with mock data (no API required)
- **Live mode** — Access `/?txId=tx_123` to load a real session from the API

### Production Build

```bash
bun run build
bun run start
```

---

## Security Considerations

- All API calls use HTTPS
- Customer data auto-save fails silently (never exposes errors to the user)
- The payment form validates required fields (name + email) before submission
- Payment processing is handled entirely by the provider (SumUp/Stripe) — no card data touches this application
- Trust badges (SSL, Secure Payment, PCI Compliant) are displayed for buyer confidence

---

## Project Structure

```
checkout-nexflowx/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── checkout/
│   │   │   └── checkout-page.tsx
│   │   └── ui/ (shadcn/ui components)
│   ├── hooks/
│   │   ├── use-mobile.ts
│   │   └── use-toast.ts
│   └── lib/
│       ├── checkout-api.ts
│       ├── checkout-i18n.ts
│       ├── checkout-types.ts
│       ├── db.ts
│       └── utils.ts
├── public/
│   ├── walluxe-logo-nome.png
│   └── robots.txt
├── .gitignore
├── bun.lock
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

---

## License

Private repository for NeXFlowX. All rights reserved.

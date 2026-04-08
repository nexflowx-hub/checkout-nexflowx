# Dossier Técnico — NeXFlowX Hosted Checkout

> **Versão:** 1.0.0  
> **Data:** Abril 2026  
> **Stack:** Next.js 16 (App Router) · TypeScript 5 · Tailwind CSS 4 · shadcn/ui · Framer Motion  
> **Repositório:** [nexflowx-hub/checkout-nexflowx](https://github.com/nexflowx-hub/checkout-nexflowx)

---

## 1. Visão Geral

A **NeXFlowX Hosted Checkout** é um portal de pagamento centralizado, inspirado no Stripe Checkout, onde comerciantes externos redirecionam os seus clientes para uma página segura de pagamento.

O sistema suporta:
- **Dynamic Branding** — cores, logo e nome do merchant são carregados via API
- **Auto-save** — dados do cliente guardados silenciosamente com debounce de 500ms
- **SumUp Card Widget v2** — widget de cartão embebido (headless) com suporte 3D Secure
- **Stripe Redirect** — redirecionamento para o checkout Stripe quando configurado
- **i18n** — 6 idiomas com deteção automática por IP geolocalizado
- **Mobile-first** — design responsivo com split-screen (formulário + resumo)

---

## 2. Arquitetura

### 2.1 Componentes da Aplicação

```
src/
├── app/
│   ├── layout.tsx              ← Root layout (metadata, fontes, Toaster)
│   ├── page.tsx                ← Entry point (Suspense wrapper)
│   └── globals.css             ← Estilos globais (Tailwind)
├── components/
│   └── checkout/
│       └── checkout-page.tsx   ← Componente principal (757 linhas)
├── lib/
│   ├── checkout-api.ts         ← API layer + SumUp SDK integration (158 linhas)
│   ├── checkout-types.ts       ← TypeScript interfaces + mock data (86 linhas)
│   └── checkout-i18n.ts        ← Sistema de internacionalização (344 linhas)
└── hooks/
    └── use-toast.ts            ← Toast notification hook (shadcn/ui)
```

### 2.2 Fluxo de Dados

```
┌─────────────┐     GET /checkout-session/:txId     ┌──────────────────┐
│   Browser    │ ──────────────────────────────────→  │   NeXFlowX API   │
│  (Next.js)   │ ←─────────────────────────────────  │  (api.nexflowx.   │
│              │       CheckoutSession JSON          │     tech/api/v1)  │
└──────┬──────┘                                      └──────────────────┘
       │
       │ Cliente preenche formulário
       │
       │ PATCH /checkout-session/:txId/customer   (debounce 500ms)
       │─────────────────────────────────────────→
       │
       │ Cliente clica "Pagar"
       │
       │ POST /checkout-session/:txId/initiate
       │─────────────────────────────────────────→
       │
       │←── { provider: "sumup", checkout_id: "..." }
       │        OU
       │←── { provider: "stripe", redirect_url: "..." }
       │
       ├─ SumUp → mountSumUpCard() → Widget embebido inline
       └─ Stripe → window.location.href = redirect_url
```

---

## 3. Integração com API (Backend)

### 3.1 Variável de Ambiente

| Variável | Descrição | Default |
|----------|-----------|---------|
| `NEXT_PUBLIC_API_URL` | URL base da API por ambiente | `https://api.nexflowx.tech/api/v1` |

### 3.2 Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/checkout-session/:txId` | Obtém sessão de checkout (dados do merchant, valor, branding) |
| `PATCH` | `/checkout-session/:txId/customer` | Atualiza dados do cliente (auto-save) |
| `POST` | `/checkout-session/:txId/initiate` | Inicia pagamento (retorna provider + checkout_id/redirect_url) |

### 3.3 Contrato da Sessão (CheckoutSession)

```typescript
{
  id: string;                    // ID da transação (txId)
  amount: number;                // Valor em decimal (ex: 120.50)
  currency: string;              // Código ISO 4217 (ex: "EUR")
  merchant_name: string;         // Nome do merchant (ex: "Walluxe Store")
  branding: {
    logo_url?: string;           // URL absoluta ou relativa do logo
    primary_color: string;       // Cor principal (#hex) — botões, ícones
    accent_color: string;        // Cor de destaque (#hex) — cartão merchant
  };
  allowed_methods: string[];     // Ex: ["card"]
}
```

### 3.4 Resposta do Initiate (PaymentInitiateResponse)

```typescript
// SumUp:
{ provider: "sumup", checkout_id: "abc123..." }

// Stripe:
{ provider: "stripe", redirect_url: "https://checkout.stripe.com/..." }
```

### 3.5 Headers CORS Esperados

O backend deve aceitar:
- `Access-Control-Allow-Origin: *` (ou domínio específico da Vercel)
- `Access-Control-Allow-Methods: GET, PATCH, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

---

## 4. Integração SumUp Card Widget v2

### 4.1 Referência Oficial

Documentação: https://developer.sumup.com/online-payments/checkouts/card-widget

### 4.2 URL do SDK

```
https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js
```

> ⚠️ A versão v1.2 (`.../card/v1.2/js/sdk.js`) está **descontinuada** e retorna 404.

### 4.3 Mecanismo de Montagem

```typescript
// O SDK expõe o objeto global `SumUpCard` após carregamento
(window as any).SumUpCard.mount({
  id: "sumup-card-container",    // ID da <div> no DOM
  checkoutId: "abc123",          // checkout_id do POST /initiate
  onResponse: (type, body) => {
    if (type === "success") { /* pagamento completo */ }
    else { /* falha ou rejeição */ }
  }
});
```

### 4.4 Fluxo SumUp no Checkout

1. O cliente clica **"Pagar"** no formulário
2. O frontend faz `POST /checkout-session/:txId/initiate`
3. O backend retorna `{ provider: "sumup", checkout_id: "..." }`
4. O `mountSumUpCard()` injeta o SDK `<script>` no `<head>` (async)
5. Após `onload`, invoca `SumUpCard.mount()` na `<div id="sumup-card-container">`
6. O widget de cartão renderiza **inline** — sem redirecionamento, sem popup
7. Se o banco exigir, a SumUp injeta o modal **3D Secure** automaticamente
8. `onResponse("success")` → pagamento concluído

### 4.5 Tratamento de Erros

| Cenário | Comportamento |
|---------|---------------|
| SDK não carrega (404/offline) | `onerror` do script → mensagem de erro |
| `SumUpCard` não definido | Guarda com `?.` (optional chaining) |
| Pagamento rejeitado | `onResponse` com type ≠ "success" → erro no UI |
| Cliente cancela | Botão "Voltar" → volta ao formulário |

---

## 5. Sistema de Internacionalização (i18n)

### 5.1 Idiomas Suportados

| Código | Idioma | Países mapeados |
|--------|--------|----------------|
| `pt` | Português | PT, BR, AO, MZ, CV, TL, GW, ST |
| `es` | Español | ES, MX, AR, CO, CL, PE, EC, VE, UY, PY, BO, CU, DO, GT, HN, NI, PA, SV, CR, GQ |
| `fr` | Français | FR, BE, LU, MC, SN, CI, ML, BF, NE, TD, GA, CG, CD, HT |
| `de` | Deutsch | DE, AT, CH, LI |
| `it` | Italiano | IT, SM, VA |
| `en` | English | Todos os restantes (fallback) |

### 5.2 Deteção Automática

No mount, o cliente faz uma requisição a `https://ipapi.co/json/` (com fallback para `https://freeipapi.com/api/json`) para obter o país do comprador via IP. O código do país é mapeado ao locale correspondente.

### 5.3 Seletor Manual

O utilizador pode trocar o idioma a qualquer momento através do seletor de bandeiras no canto superior direito.

### 5.4 Formatação de Moeda

Cada locale tem um mapeamento para locale ICU:
```typescript
{ pt: 'pt-PT', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', en: 'en-US' }
```

---

## 6. UX e Design

### 6.1 Estados da Interface

| Fase | Descrição | Visual |
|------|-----------|--------|
| `loading` | A carregar sessão da API | Skeleton animado (5 fields + summary) |
| `form` | Formulário preenchível | Split-screen: form (3/5) + resumo (2/5) |
| `processing` | Redirecionando para Stripe | Spinner + mensagem de espera |
| `external_payment` | Widget SumUp embebido | Cartão merchant + `SumUpCard` widget |
| `error` | Erro na sessão ou pagamento | Ícone + mensagem + botão retry |

### 6.2 Dynamic Branding

As cores do merchant são aplicadas em tempo real via CSS custom properties:
```css
style="--brand: {primary_color}; --brand-accent: {accent_color}"
```

Aplicadas em:
- Botão "Pagar" → `backgroundColor: var(--brand)`
- Ícone do formulário → `backgroundColor: var(--brand)`
- Ring de focus dos inputs → `--tw-ring-color: {primary_color}40`
- Total no resumo → `color: var(--brand)`
- Card do merchant → `backgroundColor: var(--brand-accent)`

### 6.3 Auto-save

- Debounce de 500ms via `useDebouncedCallback` custom hook
- Envia apenas campos não-vazios via `PATCH`
- Falha silenciosa com `console.warn` (nunca bloqueia o UX)
- Indicador visual "A guardar..." durante o save

### 6.4 Mobile-first

- Layout single-column em mobile (`grid-cols-1`)
- Split-screen em `lg:` breakpoint (`lg:grid-cols-5` → 3+2)
- Touch targets ≥ 44px em todos os elementos interativos
- Seletor de idioma com label visível em mobile

---

## 7. Deploy na Vercel

### 7.1 Configuração

```bash
# Variáveis de ambiente (Vercel Dashboard → Settings → Environment Variables)
NEXT_PUBLIC_API_URL=https://api.nexflowx.tech/api/v1
```

### 7.2 Comandos

```bash
# Build (não necessário manualmente — Vercel faz build automático)
npx next build

# Dev local
npx next dev -p 3000
```

### 7.3 Rotas

| Rota | Descrição |
|------|-----------|
| `/` | Modo demo (dados mock da Walluxe Store) |
| `/?txId=TRANSACTION_ID` | Modo produção (fetch à API real) |

---

## 8. Estrutura de Ficheiros (Final)

```
checkout-nexflowx/
├── public/
│   ├── robots.txt              ← SEO padrão
│   └── walluxe-logo-nome.png   ← Logo do merchant (demo)
├── prisma/
│   └── schema.prisma           ← Schema DB (reservado para uso futuro)
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx          ← Root layout
│   │   └── page.tsx            ← Entry point
│   ├── components/
│   │   ├── checkout/
│   │   │   └── checkout-page.tsx  ← UI principal (757 linhas)
│   │   └── ui/                 ← shadcn/ui components (usados: button, input, label, select, separator, skeleton, toast, toaster)
│   ├── hooks/
│   │   └── use-toast.ts        ← Toast hook
│   └── lib/
│       ├── checkout-api.ts     ← API + SumUp SDK (158 linhas)
│       ├── checkout-i18n.ts    ← i18n (344 linhas)
│       ├── checkout-types.ts   ← Tipos + mock (86 linhas)
│       └── utils.ts            ← Utilidades gerais (cn)
├── .env.local                  ← Variáveis de ambiente locais
├── next.config.ts              ← Configuração Next.js
├── tailwind.config.ts          ← Configuração Tailwind CSS
├── tsconfig.json               ← Configuração TypeScript
└── package.json                ← Dependências
```

---

## 9. Dependências Principais

| Pacote | Versão | Uso |
|--------|--------|-----|
| `next` | 16.x | Framework principal (App Router) |
| `react` / `react-dom` | 19.x | UI library |
| `typescript` | 5.x | Type safety |
| `tailwindcss` | 4.x | Utility-first CSS |
| `framer-motion` | 11.x | Animações e transições |
| `lucide-react` | - | Ícones SVG |
| `@radix-ui/react-*` | - | Componentes shadcn/ui (select, label, etc.) |
| `class-variance-authority` | - | Variantes de componentes |
| `clsx` + `tailwind-merge` | - | Utilidade `cn()` |

---

## 10. Segurança

- **SSL/TLS** — Deploy via Vercel (HTTPS obrigatório)
- **CORS** — Backend configurado para aceitar origens da Vercel
- **Mixed Content** — Todos os endpoints usam HTTPS (ipapi.co, freeipapi.com, gateway.sumup.com)
- **3D Secure** — Gerido automaticamente pelo SumUp Card Widget v2
- **XSS** — React sanitiza automaticamente; sem `dangerouslySetInnerHTML`
- **Dados sensíveis** — Nenhum dado de cartão é processado no frontend (delegado ao SumUp)
- **PCI Compliance** — O widget SumUp é iframed e isola os dados de pagamento

---

## 11. Resolução de Problemas Conhecidos

| Problema | Solução |
|----------|---------|
| 404 ao carregar `sdk.js` | SDK da SumUp v1.2 está descontinuado → usar v2 (`card/v2/sdk.js`) |
| Loading infinito | Sessão não retorna ou timeout → transição sempre para `form` ou `error` |
| Mixed Content em HTTPS | Fallback geolocalização usa `http://ip-api.com` → substituído por `https://freeipapi.com` |
| Auto-save bloqueia UI | Mudado de throw silencioso para `console.warn` |
| SDK SumUp não carrega | Adicionado `onerror` no script tag com mensagem clara |

---

*Documento gerado automaticamente. Para questões, contactar a equipa de engenharia NeXFlowX.*

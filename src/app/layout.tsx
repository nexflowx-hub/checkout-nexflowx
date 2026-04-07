import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  title: "Pagamentos Walluxe — Checkout Seguro",
  description:
    "Finalize a sua compra com segurança. Pagamentos rápidos e protegidos via Walluxe Store.",
  keywords: ["pagamento", "checkout", "Walluxe", "pagamento online", "cartão de crédito", "seguro"],
  authors: [{ name: "Walluxe" }],
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "pt_PT",
    siteName: "Walluxe",
    title: "Pagamentos Walluxe — Checkout Seguro",
    description:
      "Finalize a sua compra com segurança. Pagamentos rápidos e protegidos via Walluxe Store.",
  },
  twitter: {
    card: "summary",
    title: "Pagamentos Walluxe",
    description: "Checkout seguro para pagamentos Walluxe.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

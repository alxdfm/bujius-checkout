import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bujius Checkout',
  description: 'One Solana transaction pays the merchant and every partner.',
  icons: '/icon.svg',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        <header className="mx-auto max-w-2xl px-6 pt-6 text-sm font-medium">Bujius Checkout</header>
        <main className="mx-auto max-w-2xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}

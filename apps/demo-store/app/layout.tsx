import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CartLink } from './cart-link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Demo Store — Bujius Checkout',
  description: 'A store with no database, paid through one atomic Solana transaction.',
  icons: '/icon.svg',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        <header className="mx-auto flex max-w-2xl items-center justify-between px-6 pt-6 text-sm">
          <Link href="/" className="font-medium">
            Demo Store
          </Link>
          <CartLink />
        </header>
        <main className="mx-auto max-w-2xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}

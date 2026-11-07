import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { SiteHeader } from './site-header';

export const metadata: Metadata = {
  title: 'Demo Store — Bujius Checkout',
  description: 'A store with no database, paid through one atomic Solana transaction.',
  icons: '/icon.svg',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-zinc-900 antialiased">
        <SiteHeader />
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function BuyButton({ sku, label }: { sku: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ sku, qty: 1 }] }),
      });
      const body = (await response.json()) as { token?: string; error?: string };
      if (!response.ok || !body.token) {
        throw new Error(body.error ?? 'We could not create this order. Try again.');
      }
      router.push(`/checkout/${body.token}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not create this order. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={buy}
        disabled={busy}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium whitespace-nowrap text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {busy ? 'Creating order…' : label}
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}

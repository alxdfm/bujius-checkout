'use client';

import { BujiusCheckoutWalletProvider, PayButton, PaymentQR, usePaymentStatus } from '@bujius/checkout-react';
import { useEffect, useState } from 'react';
import { ChargeExpired, ChargePaid, Notice } from './charge-outcome';
import { isSendInFlight } from './send-lock';
import { useSendLock } from './use-send-lock';

interface CheckoutPanelProps {
  chargeId: string;
  /** Already formatted: "12.50". */
  amount: string;
  paymentLink: string;
  transactionRequestUrl: string;
  statusUrl: string;
  /** Already checked: `https:` or `null`. */
  successUrl: string | null;
  /** From the server's clock: a wrong clock on the payer's device must not end the charge. */
  secondsLeft: number;
  rpcEndpoint: string;
}

function useCountdown(secondsLeft: number): number {
  const [left, setLeft] = useState(secondsLeft);
  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setLeft(secondsLeft - Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);
  return Math.max(left, 0);
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

function Panel({
  chargeId,
  amount,
  paymentLink,
  transactionRequestUrl,
  statusUrl,
  successUrl,
  secondsLeft,
}: Omit<CheckoutPanelProps, 'rpcEndpoint'>) {
  const { status, signature, error } = usePaymentStatus(statusUrl);
  const left = useCountdown(secondsLeft);
  const { sentAt, markSent } = useSendLock(chargeId);
  const [payError, setPayError] = useState<string | null>(null);

  // Only the status route gets the payer here: the button's callback never does.
  const leaving = status === 'paid' && successUrl !== null;
  useEffect(() => {
    if (leaving) {
      window.location.replace(successUrl);
    }
  }, [leaving, successUrl]);

  if (leaving) {
    return <p className="text-zinc-600">Paid. Taking you back to the store…</p>;
  }
  if (status === 'paid' || status === 'paid_late') {
    return <ChargePaid late={status === 'paid_late'} signature={signature} />;
  }
  if (status === 'expired') {
    return <ChargeExpired />;
  }
  if (status === 'invalid') {
    return <Notice title="Payment not confirmed" text="We could not confirm this payment. Contact the store." />;
  }

  // The countdown renders this every second, so the lock opens by itself when the window ends.
  const inFlight = sentAt !== undefined && isSendInFlight(sentAt, Date.now());
  const open = left > 0 && sentAt !== undefined && !inFlight;
  const didNotLand = open && sentAt !== null;
  return (
    <>
      <h1 className="text-2xl font-semibold">Pay {amount} USDC</h1>
      {left > 0 && <p className="mt-1 text-sm text-zinc-600">Expires in {clock(left)}.</p>}

      {open && (
        <div className="mt-8 flex flex-col items-start gap-6 sm:flex-row">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <PaymentQR url={paymentLink} />
          </div>
          <div>
            <p className="text-sm text-zinc-600">Scan with a Solana wallet, or pay from this browser.</p>
            <div className="mt-3">
              <PayButton
                transactionRequestUrl={transactionRequestUrl}
                onSigned={() => {
                  markSent();
                  setPayError(null);
                }}
                onError={(_code, sentence) => setPayError(sentence)}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
              />
            </div>
            {didNotLand && (
              <p className="mt-3 text-sm text-zinc-600">We did not see your last payment land. It can no longer go through, so you can pay again.</p>
            )}
            {payError && <p className="mt-3 text-sm text-red-700">{payError}</p>}
          </div>
        </div>
      )}
      {inFlight && <p className="mt-8 text-zinc-600">Your wallet sent the payment. Waiting for the network to confirm it…</p>}
      {!inFlight && left === 0 && <p className="mt-8 text-zinc-600">Time is up. Checking whether a payment landed…</p>}
      {error && <p className="mt-3 text-sm text-zinc-600">{error}</p>}
    </>
  );
}

export function CheckoutPanel({ rpcEndpoint, ...panel }: CheckoutPanelProps) {
  return (
    <BujiusCheckoutWalletProvider endpoint={rpcEndpoint}>
      <Panel {...panel} />
    </BujiusCheckoutWalletProvider>
  );
}

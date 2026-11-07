import { paymentUrl } from '@bujius/checkout-sdk';
import { redirect } from 'next/navigation';
import { safeSuccessUrl } from './charge';
import { ChargeExpired, ChargeNotFound, ChargePaid } from './charge-outcome';
import { CheckoutPanel } from './checkout-panel';
import { formatUsdc } from './format-usdc';
import { readMockCharge } from './mock-charges';

export const dynamic = 'force-dynamic';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

export default async function HostedCheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Read here first, so an unknown charge never reaches the panel's polling and a finished one
  // never shows a QR.
  const charge = readMockCharge(id);
  if (!charge) {
    return <ChargeNotFound />;
  }

  const successUrl = safeSuccessUrl(charge.successUrl);
  if (charge.status === 'paid' && successUrl) {
    redirect(successUrl);
  }
  if (charge.status === 'paid' || charge.status === 'paid_late') {
    return <ChargePaid late={charge.status === 'paid_late'} signature={charge.signature} />;
  }
  if (charge.status === 'expired') {
    return <ChargeExpired />;
  }

  const transactionRequestUrl = `${required('NEXT_PUBLIC_BASE_URL').replace(/\/+$/, '')}/pay/${charge.reference}`;
  return (
    <CheckoutPanel
      chargeId={id}
      amount={formatUsdc(BigInt(charge.amount))}
      paymentLink={paymentUrl(transactionRequestUrl)}
      transactionRequestUrl={transactionRequestUrl}
      statusUrl={`/c/${id}/mock-status`}
      successUrl={successUrl}
      secondsLeft={Math.floor((Date.parse(charge.expiresAt) - Date.now()) / 1000)}
      rpcEndpoint={required('NEXT_PUBLIC_RPC_URL')}
    />
  );
}

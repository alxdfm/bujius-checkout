import { PaymentQR } from '@bujius/checkout-react';
import { paymentUrl } from '@bujius/checkout-sdk';
import { formatUsdc } from '@/lib/catalog';
import { isExpired, readOrderToken } from '@/lib/order-token';
import { readStoreEnv } from '@/lib/store-env';

export const dynamic = 'force-dynamic';

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-zinc-600">{text}</p>
      <a href="/" className="mt-6 inline-block text-sm underline">
        Back to the store
      </a>
    </>
  );
}

export default async function CheckoutPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { baseUrl, orderSecret } = readStoreEnv();

  const order = readOrderToken(token, orderSecret);
  if (!order) {
    return <Notice title="Order not found" text="This order does not exist." />;
  }
  if (isExpired(order, Math.floor(Date.now() / 1000))) {
    return <Notice title="Order expired" text="This order expired. Go back to the store and start again." />;
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Pay {formatUsdc(BigInt(order.a))} USDC</h1>
      <p className="mt-1 text-sm text-zinc-600">Order {order.o}. Scan with a Solana wallet.</p>
      <div className="mt-8 inline-block rounded-lg border border-zinc-200 bg-white p-4">
        <PaymentQR url={paymentUrl(`${baseUrl}/api/pay/${token}`)} />
      </div>
    </>
  );
}

import { paymentUrl } from '@bujius/checkout-sdk';
import { redirect } from 'next/navigation';
import { formatUsdc } from '@/lib/catalog';
import { isNetworkBusy, readOrderStatus } from '@/lib/order-status';
import { readOrderToken } from '@/lib/order-token';
import { getStoreChain } from '@/lib/store-chain';
import { readBrowserRpcUrl, readStoreEnv } from '@/lib/store-env';
import { Notice } from '../../notice';
import { CheckoutPanel } from './checkout-panel';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { baseUrl, orderSecret } = readStoreEnv();

  const order = readOrderToken(token, orderSecret);
  if (!order) {
    return <Notice title="Order not found" text="This order does not exist." />;
  }

  const now = Math.floor(Date.now() / 1000);
  // Asked here so a finished order never shows a QR. With the network busy the panel keeps asking,
  // and the pay route still refuses an order it finds paid.
  let status = 'pending';
  try {
    status = (await readOrderStatus(getStoreChain(), order, now)).status;
  } catch (error) {
    if (!isNetworkBusy(error)) {
      throw error;
    }
  }
  if (status === 'paid' || status === 'paid_late' || status === 'invalid') {
    redirect(`/orders/${token}`);
  }
  if (status === 'expired') {
    return (
      <Notice
        title="Order expired"
        text="This order expired. Go back to the store and start again."
        href="/cart"
        action="Back to the cart"
      />
    );
  }

  const transactionRequestUrl = `${baseUrl}/api/pay/${token}`;
  return (
    <CheckoutPanel
      token={token}
      orderId={order.o}
      amount={formatUsdc(BigInt(order.a))}
      paymentLink={paymentUrl(transactionRequestUrl)}
      transactionRequestUrl={transactionRequestUrl}
      secondsLeft={order.e - now}
      rpcEndpoint={readBrowserRpcUrl()}
    />
  );
}

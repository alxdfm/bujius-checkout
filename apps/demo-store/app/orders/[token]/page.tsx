import { redirect } from 'next/navigation';
import { formatUsdc } from '@/lib/catalog';
import { explorerUrl } from '@/lib/explorer';
import { isNetworkBusy, readOrderStatus, type OrderStatus } from '@/lib/order-status';
import { readOrderToken } from '@/lib/order-token';
import { getStoreChain } from '@/lib/store-chain';
import { readStoreEnv } from '@/lib/store-env';
import { Notice } from '../../notice';

export const dynamic = 'force-dynamic';

const shortWallet = (wallet: string) => `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;

export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = readOrderToken(token, readStoreEnv().orderSecret);
  if (!order) {
    return <Notice title="Order not found" text="This order does not exist." />;
  }

  let result: OrderStatus;
  try {
    // This page asks the chain again: it never takes "paid" from the page that sent the payer here.
    result = await readOrderStatus(getStoreChain(), order, Math.floor(Date.now() / 1000));
  } catch (error) {
    if (!isNetworkBusy(error)) {
      throw error;
    }
    return (
      <Notice
        title="We could not check this order"
        text="The network is busy. Try again in a moment."
        href={`/orders/${token}`}
        action="Check again"
      />
    );
  }

  if (result.status === 'pending') {
    redirect(`/checkout/${token}`);
  }
  if (result.status === 'expired') {
    return (
      <Notice
        title="Order expired"
        text="This order expired. Go back to the store and start again."
        href="/cart"
        action="Back to the cart"
      />
    );
  }

  const explorerLink = (
    <a href={explorerUrl(result.signature)} target="_blank" rel="noreferrer" className="mt-6 inline-block text-sm underline">
      See this transaction on the explorer
    </a>
  );

  if (result.status === 'invalid') {
    return (
      <>
        <h1 className="text-2xl font-semibold">This payment does not match the order</h1>
        <p className="mt-2 text-zinc-600">
          A transaction carries this order&apos;s reference, but it did not pay the amount and the split of order {order.o}.
          Contact the store with the link below.
        </p>
        {explorerLink}
      </>
    );
  }

  const lastLeg = result.legs.length - 1;
  return (
    <>
      <h1 className="text-2xl font-semibold">{result.status === 'paid' ? 'Paid' : 'Paid after the order expired'}</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Order {order.o}: {formatUsdc(BigInt(order.a))} USDC.
        {result.status === 'paid_late' ? ' Your payment went through after its time ran out. Contact the store.' : ''}
      </p>
      <h2 className="mt-8 text-sm font-medium">One transaction paid each of them</h2>
      <ul className="mt-2 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white text-sm">
        {result.legs.map((leg, index) =>
          leg.amount === 0n ? null : (
            <li key={leg.wallet.toBase58()} className="flex items-center justify-between gap-4 p-4">
              <span>
                {index === lastLeg ? 'Merchant' : 'Recipient'}{' '}
                <span className="font-mono text-zinc-600">{shortWallet(leg.wallet.toBase58())}</span>
              </span>
              <span className="font-medium">{formatUsdc(leg.amount)} USDC</span>
            </li>
          ),
        )}
      </ul>
      {explorerLink}
    </>
  );
}

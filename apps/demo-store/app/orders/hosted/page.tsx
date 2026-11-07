import Link from 'next/link';
import { formatUsdc } from '@/lib/catalog';
import { explorerUrl } from '@/lib/explorer';
import { describeDelivery, readHostedCharge, readHostedEnv, type HostedCharge } from '@/lib/hosted-api';
import { Notice } from '../../notice';
import { ClearPaidCart } from './clear-paid-cart';

export const dynamic = 'force-dynamic';

const ORDER_NOT_FOUND = <Notice title="Order not found" text="This order does not exist." />;

export default async function HostedOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ chargeId?: string | string[] }>;
}) {
  const { chargeId } = await searchParams;
  const env = readHostedEnv();
  if (!env || typeof chargeId !== 'string' || !chargeId) {
    return ORDER_NOT_FOUND;
  }
  const thisPage = `/orders/hosted?chargeId=${encodeURIComponent(chargeId)}`;

  let charge: HostedCharge | null;
  try {
    // The id comes from the URL, so this page asks the API: it never takes "paid" from the link.
    charge = await readHostedCharge(env, chargeId);
  } catch (error) {
    console.error('Hosted charge read failed:', error instanceof Error ? error.message : 'unknown error');
    return (
      <Notice
        title="We could not check this order"
        text="The hosted checkout did not answer. Try again in a moment."
        href={thisPage}
        action="Check again"
      />
    );
  }
  if (!charge) {
    return ORDER_NOT_FOUND;
  }

  if (charge.status === 'pending') {
    return (
      <Notice
        title="Waiting for payment"
        text={`Order ${charge.orderId} has not been paid yet.`}
        href={charge.checkoutUrl}
        action="Back to the checkout"
      />
    );
  }
  if (charge.status === 'expired') {
    return (
      <Notice
        title="Order expired"
        text="This order expired. Go back to the store and start again."
        href="/cart"
        action="Back to the cart"
      />
    );
  }

  const delivery = describeDelivery(charge.delivery);
  return (
    <>
      <ClearPaidCart />
      <h1 className="text-2xl font-semibold">{charge.status === 'paid' ? 'Paid' : 'Paid after the order expired'}</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Order {charge.orderId}: {formatUsdc(charge.amount)} USDC.
        {charge.status === 'paid_late' ? ' Your payment went through after its time ran out. Contact the store.' : ''}
      </p>
      <p className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
        {delivery.text}{' '}
        {!delivery.delivered && (
          <Link href={thisPage} className="underline">
            Check again
          </Link>
        )}
      </p>
      {charge.signature && (
        <a
          href={explorerUrl(charge.signature)}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-block text-sm underline"
        >
          See this transaction on the explorer
        </a>
      )}
    </>
  );
}

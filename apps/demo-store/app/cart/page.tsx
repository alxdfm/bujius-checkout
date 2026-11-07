import { pricedCatalog } from '@/lib/catalog';
import { readHostedEnv } from '@/lib/hosted-api';
import { CartView } from './cart-view';

// Read per request: hosted mode is a deployment's env, not part of the build.
export const dynamic = 'force-dynamic';

export default function CartPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Your cart</h1>
      <CartView products={pricedCatalog()} hostedEnabled={readHostedEnv() !== null} />
    </>
  );
}

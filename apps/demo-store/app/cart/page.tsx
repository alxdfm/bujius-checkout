import { pricedCatalog } from '@/lib/catalog';
import { CartView } from './cart-view';

export default function CartPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Your cart</h1>
      <CartView products={pricedCatalog()} />
    </>
  );
}

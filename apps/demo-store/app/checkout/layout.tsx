import type { ReactNode } from 'react';

/** The payment pages keep their single narrow column inside the store's wide layout. */
export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-2xl py-4">{children}</div>;
}

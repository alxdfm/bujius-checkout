import type { ReactNode } from 'react';

/** The order pages keep their single narrow column inside the store's wide layout. */
export default function OrdersLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-2xl py-4">{children}</div>;
}

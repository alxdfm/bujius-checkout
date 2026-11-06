import { createQR } from '@solana/pay';
import { useEffect, useRef } from 'react';

export interface PaymentQRProps {
  /** A `solana:` URL, as `paymentUrl` returns it. */
  url: string;
  size?: number;
}

/** The QR of a `solana:` URL. It draws in the browser only. */
export function PaymentQR({ url, size = 256 }: PaymentQRProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) {
      return;
    }
    createQR(url, size, 'white', 'black').append(element);
    return () => {
      element.replaceChildren();
    };
  }, [url, size]);

  return <div ref={container} style={{ width: size, height: size }} />;
}

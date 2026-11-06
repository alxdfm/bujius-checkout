import type { PaymentStrategy } from '@bujius/checkout-sdk';

export interface StoreEnv {
  rpcUrl: string;
  baseUrl: string;
  orderSecret: string;
  splitConfig: string;
  strategy: PaymentStrategy;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

/**
 * Server only: this carries `RPC_URL` and `ORDER_SECRET`. Read on each use, not at import,
 * so `next build` needs no secret.
 */
export function readStoreEnv(): StoreEnv {
  const strategy = required('PAY_STRATEGY');
  if (strategy !== 'program' && strategy !== 'transfers') {
    throw new Error('PAY_STRATEGY must be program or transfers');
  }
  return {
    rpcUrl: required('RPC_URL'),
    baseUrl: required('NEXT_PUBLIC_BASE_URL').replace(/\/+$/, ''),
    orderSecret: required('ORDER_SECRET'),
    splitConfig: required('NEXT_PUBLIC_SPLIT_CONFIG'),
    strategy,
  };
}

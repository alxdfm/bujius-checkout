import {
  ErrorCode,
  findPayment,
  type ResolveResult,
  type SplitConfig,
} from '@bujius/checkout-sdk';
import { PublicKey, type Connection } from '@solana/web3.js';
import { isExpired, readOrderToken } from './order-token';

export interface ResolveOrderDeps {
  connection: Connection;
  orderSecret: string;
  loadConfig: () => Promise<SplitConfig>;
  nowSeconds?: () => number;
}

/** The handler's `resolve`: HMAC, expiry, then the chain (contracts §4). The store holds nothing. */
export function createOrderResolver(deps: ResolveOrderDeps) {
  const { connection, orderSecret, loadConfig } = deps;
  const nowSeconds = deps.nowSeconds ?? (() => Math.floor(Date.now() / 1000));

  return async (token: string): Promise<ResolveResult> => {
    const order = readOrderToken(token, orderSecret);
    if (!order) {
      return { error: ErrorCode.ORDER_NOT_FOUND };
    }
    if (isExpired(order, nowSeconds())) {
      return { error: ErrorCode.ORDER_EXPIRED };
    }
    const reference = new PublicKey(order.r);
    if ((await findPayment(connection, reference)) !== null) {
      return { error: ErrorCode.ORDER_PAID };
    }
    return {
      config: await loadConfig(),
      amount: BigInt(order.a),
      reference,
      message: `Order ${order.o}`,
    };
  };
}

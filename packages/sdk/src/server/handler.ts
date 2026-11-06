import { PublicKey, type Connection } from '@solana/web3.js';
import { BujiusCheckoutError, ErrorCode, isBujiusCheckoutError } from '../errors';
import type { SplitConfig } from '../program/config';
import { buildSplitPayment, type PaymentStrategy } from '../strategies/transfers';

export interface ResolvedPayment {
  config: SplitConfig;
  amount: bigint;
  reference: PublicKey;
  message: string;
}

export type ResolveResult = ResolvedPayment | { error: ErrorCode };

export interface TransactionRequestOptions {
  connection: Connection;
  label: string;
  /** Absolute HTTPS URL, reachable without a session. */
  iconUrl: string;
  strategy: PaymentStrategy;
  /** Gets the last path segment of the request URL and the payer's account, already parsed. */
  resolve: (key: string, account: PublicKey) => ResolveResult | Promise<ResolveResult>;
}

// Without these on every response, the preflight fails and the wallet fails silently (contracts §4).
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const ERROR_RESPONSES: Partial<Record<ErrorCode, { status: number; sentence: string }>> = {
  [ErrorCode.INVALID_ACCOUNT]: { status: 400, sentence: 'We could not read your account. Try again.' },
  [ErrorCode.ORDER_NOT_FOUND]: { status: 404, sentence: 'This order does not exist.' },
  [ErrorCode.ORDER_HELD]: { status: 409, sentence: 'Someone else is already paying this order.' },
  [ErrorCode.ORDER_PAID]: { status: 409, sentence: 'This order is already paid.' },
  [ErrorCode.ORDER_EXPIRED]: {
    status: 410,
    sentence: 'This order expired. Go back to the store and start again.',
  },
  [ErrorCode.RPC_UNAVAILABLE]: { status: 503, sentence: 'The network is busy. Try again in a moment.' },
};

const UNPAYABLE = { status: 500, sentence: 'This order cannot be paid. Go back to the store.' };

function respond(status: number, body?: unknown): Response {
  const headers = new Headers(CORS_HEADERS);
  if (body === undefined) {
    return new Response(null, { status, headers });
  }
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { status, headers });
}

/** Safe to log: a message can carry the RPC URL and its key, so every URL is removed from it. */
function describeFailure(error: unknown): string {
  if (isBujiusCheckoutError(error)) {
    return error.code;
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message.replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<url>')}`;
  }
  return typeof error;
}

function respondToError(error: unknown): Response {
  const known = isBujiusCheckoutError(error) ? ERROR_RESPONSES[error.code] : undefined;
  const { status, sentence } = known ?? UNPAYABLE;
  if (status >= 500) {
    console.error(`Transaction request failed: ${describeFailure(error)}`);
  }
  return respond(status, { error: sentence });
}

async function readAccount(request: Request): Promise<PublicKey> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (cause) {
    throw new BujiusCheckoutError(ErrorCode.INVALID_ACCOUNT, { cause });
  }
  const account = (body as { account?: unknown } | null)?.account;
  if (typeof account !== 'string') {
    throw new BujiusCheckoutError(ErrorCode.INVALID_ACCOUNT);
  }
  try {
    return new PublicKey(account);
  } catch (cause) {
    throw new BujiusCheckoutError(ErrorCode.INVALID_ACCOUNT, { cause });
  }
}

/**
 * The Solana Pay transaction request endpoint (contracts §4). The account is read before
 * `resolve` runs, so a malformed request never reaches a `resolve` that holds an order.
 */
export function createTransactionRequestHandler(
  options: TransactionRequestOptions,
): (request: Request) => Promise<Response> {
  const { connection, label, iconUrl, strategy, resolve } = options;

  return async (request) => {
    if (request.method === 'OPTIONS') {
      return respond(204);
    }
    if (request.method === 'GET') {
      return respond(200, { label, icon: iconUrl });
    }
    if (request.method !== 'POST') {
      return respond(405, { error: 'This request is not supported.' });
    }

    try {
      const account = await readAccount(request);
      const key = new URL(request.url).pathname.split('/').filter(Boolean).at(-1) ?? '';
      const resolved = await resolve(key, account);
      if ('error' in resolved) {
        throw new BujiusCheckoutError(resolved.error);
      }
      const { config, amount, reference, message } = resolved;
      const transaction = await buildSplitPayment(
        connection,
        config,
        account,
        amount,
        reference,
        strategy,
      );
      const serialized = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
      return respond(200, { transaction: serialized.toString('base64'), message });
    } catch (error) {
      return respondToError(error);
    }
  };
}

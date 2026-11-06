import { afterEach, describe, expect, it, vi } from 'vitest';
import { MINT_SIZE, MintLayout, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Keypair, PublicKey, Transaction, type Connection } from '@solana/web3.js';
import {
  BujiusCheckoutError,
  ErrorCode,
  PROGRAM_ID,
  createTransactionRequestHandler,
  newReference,
  type PaymentStrategy,
  type ResolveResult,
  type SplitConfig,
} from '../src';

const URL_BASE = 'https://store.example/api/pay/token123';
const key = () => Keypair.generate().publicKey;

function mintAccount() {
  const data = Buffer.alloc(MINT_SIZE);
  MintLayout.encode(
    {
      mintAuthorityOption: 0,
      mintAuthority: PublicKey.default,
      supply: BigInt(0),
      decimals: 6,
      isInitialized: true,
      freezeAuthorityOption: 0,
      freezeAuthority: PublicKey.default,
    },
    data,
  );
  return { owner: TOKEN_PROGRAM_ID, data, executable: false, lamports: 0 };
}

const mint = key();
const config: SplitConfig = {
  address: key(),
  authority: key(),
  id: 1,
  mint,
  recipients: [{ wallet: key(), bps: 1000 }],
};
// Every account exists: the mint is a mint, anything else reads as a token account.
const connection = {
  getMultipleAccountsInfo: async (keys: PublicKey[]) =>
    keys.map((k) =>
      k.equals(mint)
        ? mintAccount()
        : { owner: TOKEN_PROGRAM_ID, data: Buffer.alloc(165), executable: false, lamports: 0 },
    ),
  getLatestBlockhash: async () => ({
    blockhash: 'GJ5b5Fh6YxqGkF6oYxkqkQkqGkF6oYxkqkQkqGkF6oYx',
    lastValidBlockHeight: 100,
  }),
} as unknown as Connection;

function handlerWith(
  resolve: (key: string, account: PublicKey) => ResolveResult | Promise<ResolveResult>,
  strategy: PaymentStrategy = 'transfers',
) {
  return createTransactionRequestHandler({
    connection,
    label: 'Demo Store',
    iconUrl: 'https://store.example/icon.png',
    strategy,
    resolve,
  });
}

const post = (body: unknown, url = URL_BASE) =>
  new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const validPost = () => post({ account: key().toBase58() });
const payable = (message = 'Thanks'): ResolveResult => ({
  config,
  amount: 1_000_000n,
  reference: newReference(),
  message,
});

function expectCors(response: Response) {
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
  expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
}

const SENTENCES: [ErrorCode, number, string][] = [
  [ErrorCode.INVALID_ACCOUNT, 400, 'We could not read your account. Try again.'],
  [ErrorCode.ORDER_NOT_FOUND, 404, 'This order does not exist.'],
  [ErrorCode.ORDER_HELD, 409, 'Someone else is already paying this order.'],
  [ErrorCode.ORDER_PAID, 409, 'This order is already paid.'],
  [ErrorCode.ORDER_EXPIRED, 410, 'This order expired. Go back to the store and start again.'],
  [ErrorCode.RPC_UNAVAILABLE, 503, 'The network is busy. Try again in a moment.'],
];
const UNPAYABLE = 'This order cannot be paid. Go back to the store.';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('handler: OPTIONS and GET', () => {
  it('answers the preflight with 204, no body and the CORS headers', async () => {
    const resolve = vi.fn(() => payable());
    const response = await handlerWith(resolve)(new Request(URL_BASE, { method: 'OPTIONS' }));

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expectCors(response);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('answers GET with the label and the icon, without resolving', async () => {
    const resolve = vi.fn(() => payable());
    const response = await handlerWith(resolve)(new Request(URL_BASE));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      label: 'Demo Store',
      icon: 'https://store.example/icon.png',
    });
    expectCors(response);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('answers any other method with 405 and the CORS headers', async () => {
    const response = await handlerWith(() => payable())(new Request(URL_BASE, { method: 'PUT' }));

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: 'This request is not supported.' });
    expectCors(response);
  });
});

describe('handler: POST', () => {
  it.each(['transfers', 'program'] as const)(
    'returns an unsigned %s transaction for the account, with the message',
    async (strategy) => {
      const account = key();
      const handler = handlerWith(() => payable('Order 42'), strategy);
      const response = await handler(post({ account: account.toBase58() }));

      expect(response.status).toBe(200);
      expectCors(response);
      const body = (await response.json()) as { transaction: string; message: string };
      expect(body.message).toBe('Order 42');

      const tx = Transaction.from(Buffer.from(body.transaction, 'base64'));
      expect(tx.feePayer?.equals(account)).toBe(true);
      expect(tx.signatures.every((s) => s.signature === null)).toBe(true);
      const usesProgram = tx.instructions.some((ix) => ix.programId.equals(PROGRAM_ID));
      expect(usesProgram).toBe(strategy === 'program');
    },
  );

  it('resolves the last path segment of the URL', async () => {
    const resolve = vi.fn((_: string) => payable());
    const handler = handlerWith(resolve);

    for (const url of [URL_BASE, `${URL_BASE}/`, `${URL_BASE}?cluster=devnet`]) {
      await handler(post({ account: key().toBase58() }, url));
    }

    expect(resolve.mock.calls.map((call) => call[0])).toEqual([
      'token123',
      'token123',
      'token123',
    ]);
  });

  it('hands resolve the parsed account of the payer, so it can hold an order', async () => {
    const account = key();
    const resolve = vi.fn((_: string, __: PublicKey) => payable());

    await handlerWith(resolve)(post({ account: account.toBase58() }));

    expect(resolve.mock.calls[0]![1].equals(account)).toBe(true);
  });

  it('accepts a resolve that is not async', async () => {
    const response = await handlerWith(() => payable())(validPost());
    expect(response.status).toBe(200);
  });

  it.each([
    ['not JSON', '{'],
    ['no account', {}],
    ['a null body', 'null'],
    ['a numeric account', { account: 42 }],
    ['an empty account', { account: '' }],
    ['an account that is not base58', { account: 'not-a-public-key' }],
    ['an account of the wrong length', { account: '1111' }],
  ])('refuses %s with 400 before resolving', async (_, body) => {
    const resolve = vi.fn(() => payable());
    const response = await handlerWith(resolve)(post(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: SENTENCES[0]![2] });
    expectCors(response);
    expect(resolve).not.toHaveBeenCalled();
  });
});

describe('handler: errors', () => {
  it.each(SENTENCES)('maps %s returned by resolve to %i', async (code, status, sentence) => {
    const response = await handlerWith(() => ({ error: code }))(validPost());

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: sentence });
    expectCors(response);
  });

  it.each(SENTENCES)('maps %s thrown by resolve to %i', async (code, status, sentence) => {
    const response = await handlerWith(async () => {
      throw new BujiusCheckoutError(code);
    })(validPost());

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: sentence });
    expectCors(response);
  });

  it('answers a payer the builder refuses with the INVALID_ACCOUNT sentence', async () => {
    const response = await handlerWith(() => payable())(
      post({ account: config.authority.toBase58() }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: SENTENCES[0]![2] });
    expectCors(response);
  });

  it.each([
    ['INVALID_AMOUNT from the builder', () => ({ ...payable(), amount: 0n } as ResolveResult)],
    ['CONFIG_NOT_FOUND returned by resolve', () => ({ error: ErrorCode.CONFIG_NOT_FOUND })],
    [
      'a plain Error thrown by resolve',
      () => {
        throw new Error('boom');
      },
    ],
  ] as [string, () => ResolveResult][])('answers %s with 500 and CORS', async (_, resolve) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await handlerWith(resolve)(validPost());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: UNPAYABLE });
    expectCors(response);
  });

  it('answers an unknown strategy with 500 and CORS', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await handlerWith(() => payable(), 'Program' as PaymentStrategy)(validPost());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: UNPAYABLE });
    expectCors(response);
  });

  it('logs an unexpected error with its message, every URL removed', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await handlerWith(() => {
      throw new TypeError('fetch failed https://rpc.example/?api-key=SECRET after wss://rpc.example/x');
    })(validPost());

    expect(await response.text()).not.toContain('SECRET');
    expect(log.mock.calls).toEqual([
      ['Transaction request failed: TypeError: fetch failed <url> after <url>'],
    ]);
  });

  it('logs something for a thrown value that is not an Error, without printing it', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handlerWith(() => {
      throw 'https://rpc.example/?api-key=SECRET';
    })(validPost());

    expect(log.mock.calls).toEqual([['Transaction request failed: string']]);
  });

  it.each([ErrorCode.RPC_UNAVAILABLE, ErrorCode.INVALID_AMOUNT, ErrorCode.CONFIG_NOT_FOUND])(
    'logs the code of a server failure: %s',
    async (code) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      await handlerWith(() => ({ error: code }))(validPost());

      expect(log.mock.calls).toEqual([[`Transaction request failed: ${code}`]]);
    },
  );

  it('does not log what the payer caused: every 4xx', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const [code, status] of SENTENCES) {
      if (status < 500) {
        await handlerWith(() => ({ error: code }))(validPost());
      }
    }

    expect(log).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { BorshAccountsCoder, BorshInstructionCoder, type Idl } from '@coral-xyz/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  MintLayout,
  TOKEN_PROGRAM_ID,
  decodeTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { Keypair, PublicKey, SystemProgram, type Connection, type Transaction } from '@solana/web3.js';
import {
  BujiusCheckoutError,
  ErrorCode,
  buildSplitPayment,
  fetchSplitConfig,
  findPayment,
  findSplitConfig,
  computeSplit,
  fromBaseUnits,
  isBujiusCheckoutError,
  newReference,
  paymentUrl,
  PROGRAM_ID,
  toBaseUnits,
} from '../src';
import type { SplitConfig } from '../src';
import idl from '../src/program/idl.json';

async function encodeConfig(
  authority: PublicKey,
  id: number,
  mint: PublicKey,
  recipients: { wallet: PublicKey; bps: number }[],
) {
  return new BorshAccountsCoder(idl as Idl).encode('SplitConfig', {
    authority,
    id,
    mint,
    recipients,
    bump: 255,
  });
}

// Each track appends its own describe blocks (PLAN.md §4).
describe('errors', () => {
  it('carries the code, never a sentence', () => {
    const error = new BujiusCheckoutError(ErrorCode.ORDER_HELD);
    expect(error.code).toBe('ORDER_HELD');
    expect(error.message).toBe('ORDER_HELD');
    expect(isBujiusCheckoutError(error)).toBe(true);
  });

  it('lists every code of contracts §3', () => {
    expect(Object.keys(ErrorCode).sort()).toEqual([
      'CONFIG_NOT_FOUND',
      'INVALID_ACCOUNT',
      'INVALID_AMOUNT',
      'ORDER_EXPIRED',
      'ORDER_HELD',
      'ORDER_NOT_FOUND',
      'ORDER_PAID',
      'RPC_UNAVAILABLE',
    ]);
  });
});

describe('program: findSplitConfig · fetchSplitConfig', () => {
  const authority = Keypair.generate().publicKey;

  it('derives the PDA from ["split", authority, id u16 LE]', () => {
    const expected = PublicKey.findProgramAddressSync(
      [Buffer.from('split'), authority.toBuffer(), Buffer.from([1, 1])],
      PROGRAM_ID,
    )[0];
    expect(findSplitConfig(authority, 257).equals(expected)).toBe(true);
    expect(findSplitConfig(authority, 1).equals(findSplitConfig(authority, 2))).toBe(false);
  });

  it('decodes a config account and rejects a missing one', async () => {
    const mint = Keypair.generate().publicKey;
    const wallet = Keypair.generate().publicKey;
    const address = findSplitConfig(authority, 7);
    const data = await encodeConfig(authority, 7, mint, [{ wallet, bps: 1000 }]);
    const connection = {
      getAccountInfo: async (a: PublicKey) =>
        a.equals(address) ? { owner: PROGRAM_ID, data } : null,
    } as unknown as Connection;

    const config = await fetchSplitConfig(connection, address);
    expect(config.id).toBe(7);
    expect(config.mint.equals(mint)).toBe(true);
    expect(config.recipients).toHaveLength(1);
    expect(config.recipients[0]!.bps).toBe(1000);
    await expect(
      fetchSplitConfig(connection, Keypair.generate().publicKey),
    ).rejects.toMatchObject({ code: 'CONFIG_NOT_FOUND' });
  });
});

describe('core: toBaseUnits · fromBaseUnits', () => {
  it('round-trips USDC amounts', () => {
    expect(toBaseUnits('12.50', 6)).toBe(12_500_000n);
    expect(fromBaseUnits(12_500_000n, 6)).toBe('12.5');
    expect(toBaseUnits('0', 6)).toBe(0n);
    expect(fromBaseUnits(0n, 6)).toBe('0');
    expect(toBaseUnits('1', 6)).toBe(1_000_000n);
    expect(fromBaseUnits(1n, 6)).toBe('0.000001');
  });

  it('rejects negatives, exponents, empty strings and excess decimals', () => {
    const bad = ['', '-1', '-0.1', '1e6', '1E2', '1.2.3', 'abc', '.5', '12.1234567'];
    for (const value of bad) {
      expect(() => toBaseUnits(value, 6)).toThrow(
        expect.objectContaining({ code: 'INVALID_AMOUNT' }),
      );
    }
    expect(() => fromBaseUnits(-1n, 6)).toThrow(
      expect.objectContaining({ code: 'INVALID_AMOUNT' }),
    );
  });
});

describe('core: newReference · paymentUrl', () => {
  it('returns a fresh PublicKey each call', () => {
    const a = newReference();
    const b = newReference();
    expect(a.equals(b)).toBe(false);
  });

  it('encodes a solana: transaction request URL from the handler HTTPS URL', () => {
    const url = paymentUrl('https://store.example/api/pay/token123');
    expect(url).toBe('solana:https://store.example/api/pay/token123');
  });
});

describe('core: computeSplit', () => {
  it('matches the five contract vectors', () => {
    expect(computeSplit(1_000_000n, [500])).toEqual({
      shares: [50_000n],
      merchant: 950_000n,
    });
    expect(computeSplit(1_000_001n, [333, 333])).toEqual({
      shares: [33_300n, 33_300n],
      merchant: 933_401n,
    });
    expect(computeSplit(1n, [500])).toEqual({
      shares: [0n],
      merchant: 1n,
    });
    expect(computeSplit(10_000n, [10_000])).toEqual({
      shares: [10_000n],
      merchant: 0n,
    });
    expect(computeSplit(18_446_744_073_709_551_615n, [10_000])).toEqual({
      shares: [18_446_744_073_709_551_615n],
      merchant: 0n,
    });
  });

  it('keeps merchant + Σ share = amount', () => {
    const amount = 12_345_678n;
    const { shares, merchant } = computeSplit(amount, [1000, 250, 100]);
    const sum = shares.reduce((acc, s) => acc + s, 0n);
    expect(merchant + sum).toBe(amount);
  });

  it('rejects a negative amount and bps no valid config can hold', () => {
    expect(() => computeSplit(-1n, [500])).toThrow(
      expect.objectContaining({ code: 'INVALID_AMOUNT' }),
    );
    for (const bps of [[6000, 6000], [10_001], [-1], [1.5]]) {
      expect(() => computeSplit(1_000_000n, bps)).toThrow(
        expect.objectContaining({ code: 'CONFIG_NOT_FOUND' }),
      );
    }
    expect(computeSplit(100n, [6000, 4000]).merchant).toBe(0n);
  });
});

describe('strategies: buildSplitPayment transfers', () => {
  const key = () => Keypair.generate().publicKey;
  const ata = (mint: PublicKey, owner: PublicKey) =>
    getAssociatedTokenAddressSync(mint, owner, true);
  const blockhashStub = async () => ({
    blockhash: 'GJ5b5Fh6YxqGkF6oYxkqkQkqGkF6oYxkqkQkqGkF6oYx',
    lastValidBlockHeight: 100,
  });
  const tokenAccount = {
    owner: TOKEN_PROGRAM_ID,
    data: Buffer.alloc(165),
    executable: false,
    lamports: 0,
  };

  function mintAccount(decimals: number) {
    const data = Buffer.alloc(MINT_SIZE);
    MintLayout.encode(
      {
        mintAuthorityOption: 0,
        mintAuthority: PublicKey.default,
        supply: BigInt(0),
        decimals,
        isInitialized: true,
        freezeAuthorityOption: 0,
        freezeAuthority: PublicKey.default,
      },
      data,
    );
    return { owner: TOKEN_PROGRAM_ID, data, executable: false, lamports: 0 };
  }

  function fixture(bps = 1000) {
    const [mint, authority, partner, payer] = [key(), key(), key(), key()] as [
      PublicKey,
      PublicKey,
      PublicKey,
      PublicKey,
    ];
    const config: SplitConfig = {
      address: key(),
      authority,
      id: 1,
      mint,
      recipients: [{ wallet: partner, bps }],
    };
    return { mint, authority, partner, payer, config };
  }

  /** A chain holding the 6-decimal mint and the `present` token accounts, nothing else. */
  function chain(mint: PublicKey, present: PublicKey[]) {
    return {
      getMultipleAccountsInfo: async (keys: PublicKey[]) =>
        keys.map((k) => {
          if (k.equals(mint)) return mintAccount(6);
          return present.some((p) => p.equals(k)) ? tokenAccount : null;
        }),
      getLatestBlockhash: blockhashStub,
    } as unknown as Connection;
  }

  const legsOf = (tx: Transaction) =>
    tx.instructions
      .filter((ix) => ix.programId.equals(TOKEN_PROGRAM_ID))
      .map((ix) => decodeTransferCheckedInstruction(ix, TOKEN_PROGRAM_ID));
  const createsOf = (tx: Transaction) =>
    tx.instructions.filter((ix) => ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID));

  it('builds creates for missing ATAs, transfer_checked per leg, reference on the first', async () => {
    const { mint, authority, partner, payer, config } = fixture();
    const reference = newReference();
    // partner share 100_000, merchant 900_000 — both legs non-zero, both ATAs missing
    const partnerAta = ata(mint, partner);
    const merchantAta = ata(mint, authority);
    const connection = chain(mint, [ata(mint, payer)]);
    const accountReads = vi.spyOn(connection, 'getMultipleAccountsInfo');
    const blockhashReads = vi.spyOn(connection, 'getLatestBlockhash');

    const tx = await buildSplitPayment(connection, config, payer, 1_000_000n, reference, 'transfers');

    expect(tx.feePayer?.equals(payer)).toBe(true);
    expect(tx.recentBlockhash).toBeTruthy();
    expect(accountReads.mock.calls.map((call) => call[1])).toEqual(['confirmed']);
    expect(blockhashReads.mock.calls.map((call) => call[0])).toEqual(['confirmed']);

    const creates = createsOf(tx);
    expect(creates.map((ix) => ix.keys[1]!.pubkey)).toEqual([partnerAta, merchantAta]);
    for (const create of creates) {
      expect(create.keys[0]!.pubkey.equals(payer)).toBe(true);
    }

    const legs = legsOf(tx);
    expect(legs.map((leg) => leg.keys.destination.pubkey)).toEqual([partnerAta, merchantAta]);
    expect(legs.map((leg) => leg.data.amount)).toEqual([100_000n, 900_000n]);
    for (const leg of legs) {
      expect(leg.keys.source.pubkey.equals(ata(mint, payer))).toBe(true);
      expect(leg.keys.owner.pubkey.equals(payer)).toBe(true);
      expect(leg.keys.mint.pubkey.equals(mint)).toBe(true);
      expect(leg.data.decimals).toBe(6);
    }

    const transfers = tx.instructions.filter((ix) => ix.programId.equals(TOKEN_PROGRAM_ID));
    expect(
      transfers[0]!.keys.some((k) => k.pubkey.equals(reference) && !k.isSigner && !k.isWritable),
    ).toBe(true);
    for (const later of transfers.slice(1)) {
      expect(later.keys.some((k) => k.pubkey.equals(reference))).toBe(false);
    }
  });

  it('skips a zero leg', async () => {
    const { mint, authority, partner, payer, config } = fixture(500);
    const connection = chain(mint, [ata(mint, payer), ata(mint, authority)]);

    // amount 1 → partner share 0, merchant 1 — only merchant leg, its ATA already present
    const tx = await buildSplitPayment(connection, config, payer, 1n, newReference(), 'transfers');
    expect(legsOf(tx).map((leg) => leg.keys.destination.pubkey)).toEqual([ata(mint, authority)]);
    expect(createsOf(tx)).toHaveLength(0);

    // amount 10_000 at 10_000 bps → merchant remainder 0 — only the recipient's leg
    const allToPartner = { ...config, recipients: [{ wallet: partner, bps: 10_000 }] };
    const partnerOnly = await buildSplitPayment(connection, allToPartner, payer, 10_000n, newReference(), 'transfers');
    expect(legsOf(partnerOnly).map((leg) => leg.keys.destination.pubkey)).toEqual([ata(mint, partner)]);
    expect(legsOf(partnerOnly).map((leg) => leg.data.amount)).toEqual([10_000n]);
  });

  it('rejects an amount outside 1..=u64::MAX before any RPC call', async () => {
    const { mint, payer, config } = fixture();
    const connection = chain(mint, [ata(mint, payer)]);
    const reads = vi.spyOn(connection, 'getMultipleAccountsInfo');

    for (const amount of [0n, -1n, 2n ** 64n]) {
      for (const strategy of ['transfers', 'program'] as const) {
        await expect(
          buildSplitPayment(connection, config, payer, amount, newReference(), strategy),
        ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
      }
    }
    expect(reads).not.toHaveBeenCalled();

    const max = 2n ** 64n - 1n;
    const tx = await buildSplitPayment(connection, config, payer, max, newReference(), 'transfers');
    expect(legsOf(tx).reduce((total, leg) => total + leg.data.amount, 0n)).toBe(max);
  });

  it('rejects bps above 10 000 instead of charging more than the amount', async () => {
    const { mint, payer, config } = fixture(6000);
    const over = { ...config, recipients: [...config.recipients, { wallet: key(), bps: 6000 }] };

    await expect(
      buildSplitPayment(chain(mint, [ata(mint, payer)]), over, payer, 1_000_000n, newReference(), 'transfers'),
    ).rejects.toMatchObject({ code: 'CONFIG_NOT_FOUND' });
  });

  it('rejects an off-curve payer or one who is also a leg wallet, for either strategy', async () => {
    const { mint, authority, partner, config } = fixture();
    const connection = chain(mint, [ata(mint, authority), ata(mint, partner)]);
    const reads = vi.spyOn(connection, 'getMultipleAccountsInfo');
    const pda = PublicKey.findProgramAddressSync([Buffer.from('c')], TOKEN_PROGRAM_ID)[0];

    for (const payer of [authority, partner, pda]) {
      for (const strategy of ['transfers', 'program'] as const) {
        await expect(
          buildSplitPayment(connection, config, payer, 1_000_000n, newReference(), strategy),
        ).rejects.toMatchObject({ code: 'INVALID_ACCOUNT' });
      }
    }
    expect(reads).not.toHaveBeenCalled();
  });

  it('rejects a payer with no token account', async () => {
    const { mint, config, payer } = fixture();

    await expect(
      buildSplitPayment(chain(mint, []), config, payer, 1_000_000n, newReference(), 'transfers'),
    ).rejects.toMatchObject({ code: 'INVALID_ACCOUNT' });
  });

  it('pays off-curve leg wallets: a PDA merchant and recipient', async () => {
    const [pda1, pda2] = ['a', 'b'].map(
      (seed) => PublicKey.findProgramAddressSync([Buffer.from(seed)], TOKEN_PROGRAM_ID)[0],
    ) as [PublicKey, PublicKey];
    const { mint, payer, config } = fixture();
    const offCurve = { ...config, authority: pda1, recipients: [{ wallet: pda2, bps: 1000 }] };

    const tx = await buildSplitPayment(chain(mint, [ata(mint, payer)]), offCurve, payer, 1_000_000n, newReference(), 'transfers');

    expect(legsOf(tx).map((leg) => leg.keys.destination.pubkey)).toEqual([ata(mint, pda2), ata(mint, pda1)]);
  });

  it('maps a missing or invalid mint to INVALID_ACCOUNT', async () => {
    const { mint, payer, config } = fixture();
    const respond = (mintInfo: unknown) =>
      ({
        getMultipleAccountsInfo: async (keys: PublicKey[]) =>
          keys.map((k) => {
            if (k.equals(mint)) return mintInfo;
            return k.equals(ata(mint, payer)) ? tokenAccount : null;
          }),
        getLatestBlockhash: blockhashStub,
      }) as unknown as Connection;
    const notAMint = {
      owner: SystemProgram.programId,
      data: Buffer.alloc(MINT_SIZE),
      executable: false,
      lamports: 0,
    };

    for (const mintInfo of [null, notAMint]) {
      await expect(
        buildSplitPayment(respond(mintInfo), config, payer, 1_000_000n, newReference(), 'transfers'),
      ).rejects.toMatchObject({ code: 'INVALID_ACCOUNT' });
    }
  });

  it('program strategy: creates only missing funded ATAs, then pay with recipients in order', async () => {
    const { mint, authority, partner, payer, config } = fixture();
    const reference = newReference();
    const connection = chain(mint, [ata(mint, payer), ata(mint, authority)]);

    const tx = await buildSplitPayment(connection, config, payer, 1_000_000n, reference, 'program');

    expect(tx.feePayer?.equals(payer)).toBe(true);
    expect(createsOf(tx).map((ix) => ix.keys[1]!.pubkey)).toEqual([ata(mint, partner)]);
    const pay = tx.instructions.at(-1)!;
    expect(pay.programId.equals(PROGRAM_ID)).toBe(true);
    const decoded = new BorshInstructionCoder(idl as Idl).decode(pay.data)!;
    expect(decoded.name).toBe('pay');
    expect(String((decoded.data as { amount: { toString(): string } }).amount)).toBe('1000000');
    const keys = pay.keys;
    expect(keys[0]).toMatchObject({ isSigner: true });
    expect(keys[1]!.pubkey.equals(ata(mint, payer))).toBe(true);
    expect(keys[2]!.pubkey.equals(config.address)).toBe(true);
    expect(keys[4]!.pubkey.equals(ata(mint, authority))).toBe(true);
    expect(keys[5]).toMatchObject({ isSigner: false, isWritable: false });
    expect(keys[5]!.pubkey.equals(reference)).toBe(true);
    expect(keys[7]!.pubkey.equals(ata(mint, partner))).toBe(true);
    expect(keys).toHaveLength(8);
  });

  it('program strategy: does not create the ATA of a zero leg', async () => {
    const { mint, payer, config } = fixture(500);
    const tx = await buildSplitPayment(chain(mint, [ata(mint, payer)]), config, payer, 1n, newReference(), 'program');
    // partner share is 0: only the merchant's ATA is created
    expect(createsOf(tx)).toHaveLength(1);
  });

  it('findPayment returns the earliest successful signature or null', async () => {
    const find = (sigs: { signature: string; err: unknown }[]) =>
      findPayment({ getSignaturesForAddress: async () => sigs } as unknown as Connection, key());
    expect(await find([])).toBeNull();
    expect(await find([{ signature: 'b', err: null }, { signature: 'a', err: { x: 1 } }])).toBe('b');
    expect(await find([{ signature: 'new', err: null }, { signature: 'old', err: null }])).toBe('old');
    await expect(
      findPayment({ getSignaturesForAddress: async () => { throw new Error('x'); } } as unknown as Connection, key()),
    ).rejects.toMatchObject({ code: 'RPC_UNAVAILABLE' });
  });
});

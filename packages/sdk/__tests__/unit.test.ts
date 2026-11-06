import { describe, expect, it } from 'vitest';
import { BorshAccountsCoder, type Idl } from '@coral-xyz/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  MintLayout,
  TOKEN_PROGRAM_ID,
  decodeTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { Keypair, PublicKey, SystemProgram, type Connection } from '@solana/web3.js';
import {
  BujiusCheckoutError,
  ErrorCode,
  buildSplitPayment,
  fetchSplitConfig,
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
});

describe('strategies: buildSplitPayment transfers', () => {
  const blockhashStub = async () => ({
    blockhash: 'GJ5b5Fh6YxqGkF6oYxkqkQkqGkF6oYxkqkQkqGkF6oYx',
    lastValidBlockHeight: 100,
  });

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

  it('builds creates for missing ATAs, transfer_checked per leg, reference on the first', async () => {
    const mint = Keypair.generate().publicKey;
    const authority = Keypair.generate().publicKey;
    const partner = Keypair.generate().publicKey;
    const payer = Keypair.generate().publicKey;
    const reference = newReference();
    const config: SplitConfig = {
      address: Keypair.generate().publicKey,
      authority,
      id: 1,
      mint,
      recipients: [{ wallet: partner, bps: 1000 }],
    };
    const amount = 1_000_000n;
    // partner share 100_000, merchant 900_000 — both legs non-zero
    const partnerAta = getAssociatedTokenAddressSync(mint, partner);
    const merchantAta = getAssociatedTokenAddressSync(mint, authority);

    const accountReads: unknown[] = [];
    const blockhashReads: unknown[] = [];
    const connection = {
      getMultipleAccountsInfo: async (keys: PublicKey[], commitment: unknown) => {
        accountReads.push(commitment);
        // both destination ATAs missing
        return keys.map((key) => (key.equals(mint) ? mintAccount(6) : null));
      },
      getLatestBlockhash: async (commitment: unknown) => {
        blockhashReads.push(commitment);
        return blockhashStub();
      },
    } as unknown as Connection;

    const tx = await buildSplitPayment(connection, config, payer, amount, reference, 'transfers');

    expect(tx.feePayer?.equals(payer)).toBe(true);
    expect(tx.recentBlockhash).toBeTruthy();

    const creates = tx.instructions.filter((ix) =>
      ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID),
    );
    const transfers = tx.instructions.filter((ix) =>
      ix.programId.equals(TOKEN_PROGRAM_ID),
    );
    expect(creates).toHaveLength(2);
    expect(transfers).toHaveLength(2);
    expect(accountReads).toEqual(['confirmed']);
    expect(blockhashReads).toEqual(['confirmed']);

    expect(creates.map((ix) => ix.keys[1]!.pubkey)).toEqual([partnerAta, merchantAta]);
    for (const create of creates) {
      expect(create.keys[0]!.pubkey.equals(payer)).toBe(true);
    }

    const legs = transfers.map((ix) => decodeTransferCheckedInstruction(ix, TOKEN_PROGRAM_ID));
    expect(legs.map((leg) => leg.keys.destination.pubkey)).toEqual([partnerAta, merchantAta]);
    expect(legs.map((leg) => leg.data.amount)).toEqual([100_000n, 900_000n]);
    for (const leg of legs) {
      expect(leg.keys.source.pubkey.equals(getAssociatedTokenAddressSync(mint, payer))).toBe(true);
      expect(leg.keys.owner.pubkey.equals(payer)).toBe(true);
      expect(leg.keys.mint.pubkey.equals(mint)).toBe(true);
      expect(leg.data.decimals).toBe(6);
    }

    const firstTransfer = transfers[0]!;
    expect(
      firstTransfer.keys.some(
        (k) => k.pubkey.equals(reference) && !k.isSigner && !k.isWritable,
      ),
    ).toBe(true);
    for (const later of transfers.slice(1)) {
      expect(later.keys.some((k) => k.pubkey.equals(reference))).toBe(false);
    }
  });

  it('skips a zero leg and throws for the program strategy until A4', async () => {
    const mint = Keypair.generate().publicKey;
    const authority = Keypair.generate().publicKey;
    const partner = Keypair.generate().publicKey;
    const payer = Keypair.generate().publicKey;
    const config: SplitConfig = {
      address: Keypair.generate().publicKey,
      authority,
      id: 1,
      mint,
      recipients: [{ wallet: partner, bps: 500 }],
    };
    // amount 1 → partner share 0, merchant 1 — only merchant leg
    const merchantAta = getAssociatedTokenAddressSync(mint, authority);
    const connection = {
      getMultipleAccountsInfo: async (keys: PublicKey[]) =>
        keys.map((key) => {
          if (key.equals(mint)) return mintAccount(6);
          if (key.equals(merchantAta)) return { owner: TOKEN_PROGRAM_ID, data: Buffer.alloc(165), executable: false, lamports: 0 };
          return null;
        }),
      getLatestBlockhash: blockhashStub,
    } as unknown as Connection;

    const tx = await buildSplitPayment(connection, config, payer, 1n, newReference(), 'transfers');
    const transfers = tx.instructions.filter((ix) =>
      ix.programId.equals(TOKEN_PROGRAM_ID),
    );
    expect(transfers).toHaveLength(1);
    // ATA already present → no create
    expect(
      tx.instructions.filter((ix) => ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)),
    ).toHaveLength(0);

    // amount 10_000 at 10_000 bps → merchant remainder 0 — only the recipient's leg
    const allToPartner = { ...config, recipients: [{ wallet: partner, bps: 10_000 }] };
    const partnerOnly = await buildSplitPayment(connection, allToPartner, payer, 10_000n, newReference(), 'transfers');
    const partnerLegs = partnerOnly.instructions
      .filter((ix) => ix.programId.equals(TOKEN_PROGRAM_ID))
      .map((ix) => decodeTransferCheckedInstruction(ix, TOKEN_PROGRAM_ID));
    expect(partnerLegs.map((leg) => leg.keys.destination.pubkey)).toEqual([
      getAssociatedTokenAddressSync(mint, partner),
    ]);
    expect(partnerLegs.map((leg) => leg.data.amount)).toEqual([10_000n]);

    await expect(
      buildSplitPayment(connection, config, payer, 1n, newReference(), 'program'),
    ).rejects.toThrow(/program strategy not implemented/);
  });

  it('rejects an amount outside 1..=u64::MAX before any RPC call', async () => {
    const mint = Keypair.generate().publicKey;
    const config: SplitConfig = {
      address: Keypair.generate().publicKey,
      authority: Keypair.generate().publicKey,
      id: 1,
      mint,
      recipients: [{ wallet: Keypair.generate().publicKey, bps: 1000 }],
    };
    const payer = Keypair.generate().publicKey;
    let rpcCalls = 0;
    const connection = {
      getMultipleAccountsInfo: async (keys: PublicKey[]) => {
        rpcCalls++;
        return keys.map((key) => (key.equals(mint) ? mintAccount(6) : null));
      },
      getLatestBlockhash: blockhashStub,
    } as unknown as Connection;

    for (const amount of [0n, -1n, 2n ** 64n]) {
      for (const strategy of ['transfers', 'program'] as const) {
        await expect(
          buildSplitPayment(connection, config, payer, amount, newReference(), strategy),
        ).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
      }
    }
    expect(rpcCalls).toBe(0);

    const max = await buildSplitPayment(
      connection,
      config,
      payer,
      2n ** 64n - 1n,
      newReference(),
      'transfers',
    );
    expect(max.instructions.length).toBeGreaterThan(0);
  });

  it('maps a missing or invalid mint to INVALID_ACCOUNT', async () => {
    const mint = Keypair.generate().publicKey;
    const authority = Keypair.generate().publicKey;
    const payer = Keypair.generate().publicKey;
    const config: SplitConfig = {
      address: Keypair.generate().publicKey,
      authority,
      id: 1,
      mint,
      recipients: [],
    };

    const missingMint = {
      getMultipleAccountsInfo: async (keys: PublicKey[]) => keys.map(() => null),
      getLatestBlockhash: blockhashStub,
    } as unknown as Connection;

    await expect(
      buildSplitPayment(missingMint, config, payer, 1_000_000n, newReference(), 'transfers'),
    ).rejects.toMatchObject({ code: 'INVALID_ACCOUNT' });

    const badOwner = {
      getMultipleAccountsInfo: async (keys: PublicKey[]) =>
        keys.map((key) => {
          if (key.equals(mint)) {
            return {
              owner: SystemProgram.programId,
              data: Buffer.alloc(MINT_SIZE),
              executable: false,
              lamports: 0,
            };
          }
          return null;
        }),
      getLatestBlockhash: blockhashStub,
    } as unknown as Connection;

    await expect(
      buildSplitPayment(badOwner, config, payer, 1_000_000n, newReference(), 'transfers'),
    ).rejects.toMatchObject({ code: 'INVALID_ACCOUNT' });
  });
});

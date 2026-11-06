import { describe, expect, it } from 'vitest';
import { BorshAccountsCoder, type Idl } from '@coral-xyz/anchor';
import { Keypair, PublicKey, type Connection } from '@solana/web3.js';
import {
  BujiusCheckoutError,
  ErrorCode,
  fetchSplitConfig,
  findSplitConfig,
  isBujiusCheckoutError,
  PROGRAM_ID,
} from '../src';
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

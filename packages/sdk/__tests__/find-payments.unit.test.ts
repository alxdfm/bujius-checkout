import { Keypair, type Connection } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';
import { findPayment, findPayments } from '../src';

const key = () => Keypair.generate().publicKey;
const connectionWith = (sigs: { signature: string; err: unknown }[]) =>
  ({ getSignaturesForAddress: async () => sigs }) as unknown as Connection;

describe('findPayments', () => {
  it('returns every successful signature, earliest first', async () => {
    const sigs = [
      { signature: 'newest', err: null },
      { signature: 'failed', err: { InstructionError: [0, 'x'] } },
      { signature: 'middle', err: null },
      { signature: 'oldest', err: null },
    ];
    expect(await findPayments(connectionWith(sigs), key())).toEqual(['oldest', 'middle', 'newest']);
  });

  it('returns an empty list when nothing mentions the reference', async () => {
    expect(await findPayments(connectionWith([]), key())).toEqual([]);
    expect(await findPayments(connectionWith([{ signature: 'x', err: { a: 1 } }]), key())).toEqual([]);
  });

  it('keeps findPayment on the earliest one, which is the first of findPayments', async () => {
    const connection = connectionWith([
      { signature: 'right', err: null },
      { signature: 'wrong', err: null },
    ]);
    expect(await findPayment(connection, key())).toBe('wrong');
    expect((await findPayments(connection, key()))[0]).toBe('wrong');
  });

  it('answers RPC_UNAVAILABLE when the RPC fails', async () => {
    const failing = {
      getSignaturesForAddress: async () => {
        throw new Error('down');
      },
    } as unknown as Connection;
    await expect(findPayments(failing, key())).rejects.toMatchObject({ code: 'RPC_UNAVAILABLE' });
  });
});

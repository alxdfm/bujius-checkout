import { BorshAccountsCoder, type Idl } from '@coral-xyz/anchor';
import { PublicKey, type Connection } from '@solana/web3.js';
import { BujiusCheckoutError, ErrorCode } from '../errors';
import idl from './idl.json';
import { PROGRAM_ID } from './pda';

export interface Recipient {
  wallet: PublicKey;
  bps: number;
}

export interface SplitConfig {
  address: PublicKey;
  authority: PublicKey;
  id: number;
  mint: PublicKey;
  recipients: Recipient[];
}

const coder = new BorshAccountsCoder(idl as Idl);

/** Reads and decodes a split config; throws CONFIG_NOT_FOUND if it is not ours or absent. */
export async function fetchSplitConfig(
  connection: Connection,
  address: PublicKey,
): Promise<SplitConfig> {
  let info;
  try {
    info = await connection.getAccountInfo(address, 'confirmed');
  } catch {
    throw new BujiusCheckoutError(ErrorCode.RPC_UNAVAILABLE);
  }
  if (!info || !info.owner.equals(PROGRAM_ID)) {
    throw new BujiusCheckoutError(ErrorCode.CONFIG_NOT_FOUND);
  }
  const decoded = coder.decode('SplitConfig', info.data);
  return {
    address,
    authority: decoded.authority,
    id: decoded.id,
    mint: decoded.mint,
    recipients: decoded.recipients.map((r: { wallet: PublicKey; bps: number }) => ({
      wallet: r.wallet,
      bps: r.bps,
    })),
  };
}

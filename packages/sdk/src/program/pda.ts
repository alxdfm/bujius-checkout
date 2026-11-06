import { PublicKey } from '@solana/web3.js';
import idl from './idl.json';

export const PROGRAM_ID = new PublicKey(idl.address);

/** The address of a merchant's split config. Seeds: ["split", authority, id as u16 LE]. */
export function findSplitConfig(authority: PublicKey, id: number): PublicKey {
  const idBytes = new Uint8Array(2);
  new DataView(idBytes.buffer).setUint16(0, id, true);
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('split'), authority.toBytes(), idBytes],
    PROGRAM_ID,
  )[0];
}

import { Keypair, type PublicKey } from '@solana/web3.js';

/** A fresh public key used as the Solana Pay reference for one payment. */
export function newReference(): PublicKey {
  return Keypair.generate().publicKey;
}

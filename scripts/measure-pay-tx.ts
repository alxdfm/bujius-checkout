// Measures the worst-case `pay` transaction: 4 recipients, every destination missing.
// No RPC: the connection is a stub. Prints the serialized size against the 1232-byte limit.
import { getAssociatedTokenAddressSync, MINT_SIZE, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Keypair, type Connection } from '@solana/web3.js';
import { buildSplitPayment, newReference, type SplitConfig } from '../packages/sdk/src';

const LIMIT = 1232;

async function main() {
  const payer = Keypair.generate();
  const mint = Keypair.generate().publicKey;
  const config: SplitConfig = {
    address: Keypair.generate().publicKey,
    authority: Keypair.generate().publicKey,
    id: 1,
    mint,
    recipients: Array.from({ length: 4 }, () => ({ wallet: Keypair.generate().publicKey, bps: 1000 })),
  };
  const source = getAssociatedTokenAddressSync(mint, payer.publicKey);
  const mintData = Buffer.alloc(MINT_SIZE);
  mintData[44] = 6; // decimals
  mintData[45] = 1; // initialized
  const connection = {
    // only the payer's own token account exists; every destination is missing
    getMultipleAccountsInfo: async (keys: Keypair['publicKey'][]) =>
      keys.map((k) => {
        if (k.equals(mint)) return { data: mintData, owner: TOKEN_PROGRAM_ID, lamports: 1, executable: false };
        return k.equals(source) ? { data: Buffer.alloc(165), owner: TOKEN_PROGRAM_ID, lamports: 1, executable: false } : null;
      }),
    getLatestBlockhash: async () => ({
      blockhash: Keypair.generate().publicKey.toBase58(),
      lastValidBlockHeight: 1,
    }),
  } as unknown as Connection;

  for (const strategy of ['program', 'transfers'] as const) {
    const tx = await buildSplitPayment(connection, config, payer.publicKey, 1_000_000n, newReference(), strategy);
    tx.sign(payer);
    const size = tx.serialize().length;
    console.log(`${strategy}: ${size} bytes (${size <= LIMIT ? 'ok' : 'TOO BIG'}, limit ${LIMIT})`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

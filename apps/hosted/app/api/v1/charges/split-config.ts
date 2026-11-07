import { fetchSplitConfig } from '@bujius/checkout-sdk';
import { Connection, PublicKey } from '@solana/web3.js';

// A SplitConfig is immutable, so its mint can be cached for the life of the lambda.
const mints = new Map<string, string>();

let connection: Connection | undefined;
function getConnection(): Connection {
  connection ??= new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
  return connection;
}

/** The mint (base58) of a merchant's on-chain split config. Throws if it cannot be read. */
export async function getSplitMint(splitConfig: string): Promise<string> {
  const cached = mints.get(splitConfig);
  if (cached) return cached;
  const config = await fetchSplitConfig(getConnection(), new PublicKey(splitConfig));
  const mint = config.mint.toBase58();
  mints.set(splitConfig, mint);
  return mint;
}

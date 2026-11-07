import { fetchSplitConfig, type SplitConfig } from '@bujius/checkout-sdk';
import { Connection, PublicKey } from '@solana/web3.js';

// A SplitConfig is immutable, so it can be cached for the life of the lambda.
const configs = new Map<string, SplitConfig>();

let connection: Connection | undefined;
export function getConnection(): Connection {
  connection ??= new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
  return connection;
}

/** A merchant's on-chain split config. Throws if it cannot be read. */
export async function getSplitConfig(address: string): Promise<SplitConfig> {
  const cached = configs.get(address);
  if (cached) return cached;
  const config = await fetchSplitConfig(getConnection(), new PublicKey(address));
  configs.set(address, config);
  return config;
}

/** The mint (base58) of a merchant's split config. */
export async function getSplitMint(address: string): Promise<string> {
  return (await getSplitConfig(address)).mint.toBase58();
}

import { fetchSplitConfig, type SplitConfig } from '@bujius/checkout-sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import { readStoreEnv } from './store-env';

export interface StoreChain {
  connection: Connection;
  loadConfig: () => Promise<SplitConfig>;
}

let chain: StoreChain | undefined;

/** Server only: the connection carries `RPC_URL`. Throws when an env var is missing. */
export function getStoreChain(): StoreChain {
  if (chain) {
    return chain;
  }
  const { rpcUrl, splitConfig } = readStoreEnv();
  const connection = new Connection(rpcUrl, 'confirmed');
  const address = new PublicKey(splitConfig);

  // A split config is immutable: one successful read lasts the life of the lambda.
  let config: Promise<SplitConfig> | undefined;
  const loadConfig = () => {
    config ??= fetchSplitConfig(connection, address).catch((error: unknown) => {
      config = undefined;
      throw error;
    });
    return config;
  };

  chain = { connection, loadConfig };
  return chain;
}

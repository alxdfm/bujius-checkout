// Creates the devnet test split config: a partner at 1 000 bps and a platform at 250 bps.
// Env: MERCHANT_KEYPAIR (path), PARTNER_WALLET, PLATFORM_WALLET (public keys),
//      RPC_URL (optional, defaults to public devnet), MINT (optional, defaults to devnet USDC).
import { readFileSync } from 'node:fs';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { buildCreateSplit, fetchSplitConfig, findSplitConfig } from '../packages/sdk/src';

const DEVNET_USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GfPNfGaLBFu9qZpZH2';
const CONFIG_ID = 1;

function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

async function main() {
  const merchant = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(need('MERCHANT_KEYPAIR'), 'utf8'))),
  );
  const connection = new Connection(process.env.RPC_URL ?? 'https://api.devnet.solana.com', 'confirmed');
  const mint = new PublicKey(process.env.MINT ?? DEVNET_USDC);
  const recipients = [
    { wallet: new PublicKey(need('PARTNER_WALLET')), bps: 1000 },
    { wallet: new PublicKey(need('PLATFORM_WALLET')), bps: 250 },
  ];

  const address = findSplitConfig(merchant.publicKey, CONFIG_ID);
  if (await connection.getAccountInfo(address)) {
    console.log(`Config already exists: ${address.toBase58()}`);
  } else {
    const tx = await buildCreateSplit(connection, merchant.publicKey, CONFIG_ID, mint, recipients);
    tx.sign(merchant);
    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(
      { signature, blockhash: tx.recentBlockhash!, lastValidBlockHeight: tx.lastValidBlockHeight! },
      'confirmed',
    );
    console.log(`Created in ${signature}`);
  }

  const config = await fetchSplitConfig(connection, address);
  console.log(`CONFIG ${config.address.toBase58()}`);
  for (const r of config.recipients) console.log(`  ${r.wallet.toBase58()} ${r.bps} bps`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

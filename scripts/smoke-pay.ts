// Devnet smoke: build → sign → send → findPayment, then print each leg's balance change.
// Usage: pnpm smoke --strategy program|transfers
// Env: PAYER_KEYPAIR (path), SPLIT_CONFIG (address), RPC_URL (optional), AMOUNT (optional, default 0.10)
import { readFileSync } from 'node:fs';
import { getAssociatedTokenAddressSync, unpackAccount } from '@solana/spl-token';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  buildSplitPayment,
  fetchSplitConfig,
  findPayment,
  newReference,
  toBaseUnits,
  type PaymentStrategy,
} from '../packages/sdk/src';

function need(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

function strategyArg(): PaymentStrategy {
  const i = process.argv.indexOf('--strategy');
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  if (value !== 'program' && value !== 'transfers') {
    throw new Error('Usage: pnpm smoke --strategy program|transfers');
  }
  return value;
}

async function main() {
  const strategy = strategyArg();
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(need('PAYER_KEYPAIR'), 'utf8'))),
  );
  const connection = new Connection(process.env.RPC_URL ?? 'https://api.devnet.solana.com', 'confirmed');
  const config = await fetchSplitConfig(connection, new PublicKey(need('SPLIT_CONFIG')));
  const amount = toBaseUnits(process.env.AMOUNT ?? '0.10', 6);

  const wallets = [config.authority, ...config.recipients.map((r) => r.wallet)];
  const atas = wallets.map((w) => getAssociatedTokenAddressSync(config.mint, w, true));
  const balances = async () => {
    const infos = await connection.getMultipleAccountsInfo(atas, 'confirmed');
    return infos.map((info, i) => (info ? unpackAccount(atas[i]!, info).amount : 0n));
  };

  const before = await balances();
  const reference = newReference();
  const tx = await buildSplitPayment(connection, config, payer.publicKey, amount, reference, strategy);
  tx.sign(payer);
  const signature = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(
    { signature, blockhash: tx.recentBlockhash!, lastValidBlockHeight: tx.lastValidBlockHeight! },
    'confirmed',
  );

  let found: string | null = null;
  for (let attempt = 0; attempt < 10 && !found; attempt++) {
    found = await findPayment(connection, reference);
    if (!found) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (found !== signature) throw new Error(`findPayment did not return ${signature}`);

  console.log(`PAID ${found}`);
  const after = await balances();
  wallets.forEach((wallet, i) => {
    console.log(`  ${i === 0 ? 'merchant' : 'recipient'} ${wallet.toBase58()} +${after[i]! - before[i]!}`);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

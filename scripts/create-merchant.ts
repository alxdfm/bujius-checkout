// Creates a merchant for the hosted service and prints its API key and webhook secret ONCE.
// The key is stored only as SHA-256; if it is lost, create another merchant.
// Env: DATABASE_URL, MERCHANT_NAME, SPLIT_CONFIG (the SplitConfig account address, base58;
//      defaults to the devnet test config).
// Run:  pnpm exec tsx --env-file=apps/hosted/.env.local scripts/create-merchant.ts
import { PublicKey } from '@solana/web3.js';
import { generateApiKey, generateWebhookSecret, hashApiKey } from '../apps/hosted/lib/auth';
import { getDb } from '../apps/hosted/lib/db/client';
import { merchants, newId } from '../apps/hosted/lib/db/schema';

const TEST_SPLIT_CONFIG = '3gwKrgMCA8qNp7RXrpfPs63HB5wVFACYYQC39Vx3xr3N';

async function main() {
  const name = process.env.MERCHANT_NAME;
  if (!name) throw new Error('Missing env var MERCHANT_NAME');
  const splitConfig = new PublicKey(process.env.SPLIT_CONFIG ?? TEST_SPLIT_CONFIG).toBase58();

  const apiKey = generateApiKey();
  const webhookSecret = generateWebhookSecret();
  const id = newId('mch');
  await getDb().insert(merchants).values({
    id,
    name,
    splitConfig,
    apiKeyHash: hashApiKey(apiKey),
    webhookSecret,
  });

  console.log(`MERCHANT       ${id} (${name})`);
  console.log(`SPLIT_CONFIG   ${splitConfig}`);
  console.log(`API_KEY        ${apiKey}`);
  console.log(`WEBHOOK_SECRET ${webhookSecret}`);
  console.log('Store both now: neither is shown again.');
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from './db/client';
import { merchants, type Merchant } from './db/schema';

const KEY_PREFIX = 'sk_test_';

export function generateApiKey(): string {
  return `${KEY_PREFIX}${randomBytes(32).toString('hex')}`;
}

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString('hex')}`;
}

/** The only form of an API key that is ever stored. */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** The key from `Authorization: Bearer sk_test_…`, or `null`. */
export function readBearerKey(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer (sk_test_[0-9a-f]{64})$/.exec(header.trim());
  return match?.[1] ?? null;
}

/** The merchant that owns the request's API key, or `null`. Never logs the key. */
export async function authenticate(request: Request): Promise<Merchant | null> {
  const key = readBearerKey(request.headers.get('authorization'));
  if (!key) return null;
  const rows = await getDb()
    .select()
    .from(merchants)
    .where(eq(merchants.apiKeyHash, hashApiKey(key)))
    .limit(1);
  return rows[0] ?? null;
}

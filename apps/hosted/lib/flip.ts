import { findPayment, verifySplitPayment } from '@bujius/checkout-sdk';
import { PublicKey } from '@solana/web3.js';
import { and, eq } from 'drizzle-orm';
import {
  EXPIRY_GRACE_SECONDS,
  effectiveStatus,
} from '@/app/api/v1/charges/serialize';
import { getConnection, getSplitConfig, getSplitMint } from '@/app/api/v1/charges/split-config';
import { getDb } from './db/client';
import { charges, type Charge, type Merchant } from './db/schema';
import { deliverWebhook, eventTypeFor } from './webhook';

export interface ReconcileResult {
  /** The charge as it stands now. */
  charge: Charge;
  /** The row this call flipped to paid, or `null`. Only its holder sends the webhook. */
  flipped: Charge | null;
}

/**
 * The flip (contracts §6): `UPDATE … WHERE id = … AND status = 'pending' RETURNING`. A status poll,
 * Helius and a second lambda can race; one gets the row back, the others get `null`.
 */
async function flip(
  chargeId: string,
  status: 'paid' | 'paid_late',
  signature: string,
): Promise<Charge | null> {
  try {
    const rows = await getDb()
      .update(charges)
      .set({ status, signature, paidAt: new Date() })
      .where(and(eq(charges.id, chargeId), eq(charges.status, 'pending')))
      .returning();
    return rows[0] ?? null;
  } catch (error) {
    // The same signature already settled another charge: this one stays as it is.
    if ((error as { code?: string }).code === '23505') return null;
    throw error;
  }
}

async function expire(charge: Charge): Promise<Charge> {
  const rows = await getDb()
    .update(charges)
    .set({ status: 'expired' })
    .where(and(eq(charges.id, charge.id), eq(charges.status, 'pending')))
    .returning();
  return rows[0] ?? (await reload(charge.id)) ?? charge;
}

async function reload(chargeId: string): Promise<Charge | undefined> {
  const [row] = await getDb().select().from(charges).where(eq(charges.id, chargeId)).limit(1);
  return row;
}

/**
 * Reconcile on read: while a charge is `pending`, ask the chain. `findPayment` finds the
 * signature, but only `verifySplitPayment` decides (it checks the amount and the split). A payment
 * that does not verify leaves the charge as it is. Once `expires_at` + the grace has passed with no
 * payment, `expired` is written. Throws `RPC_UNAVAILABLE` when the chain cannot be read.
 */
export async function reconcileCharge(charge: Charge, merchant: Merchant): Promise<ReconcileResult> {
  if (charge.status !== 'pending') return { charge, flipped: null };

  const connection = getConnection();
  const reference = new PublicKey(charge.reference);
  const signature = await findPayment(connection, reference);

  if (signature) {
    const config = await getSplitConfig(merchant.splitConfig);
    const verification = await verifySplitPayment(
      connection,
      signature,
      config,
      BigInt(charge.amount),
      reference,
      charge.expiresAt,
    );
    if (verification.status === 'paid' || verification.status === 'paid_late') {
      const flipped = await flip(charge.id, verification.status, signature);
      if (flipped) return { charge: flipped, flipped };
      return { charge: (await reload(charge.id)) ?? charge, flipped: null };
    }
  }

  const pastGrace =
    Date.now() > charge.expiresAt.getTime() + EXPIRY_GRACE_SECONDS * 1000;
  if (pastGrace && effectiveStatus(charge) === 'expired') {
    return { charge: await expire(charge), flipped: null };
  }
  return { charge, flipped: null };
}

/**
 * Sends the webhook for a charge this call flipped. Never throws: a store that is down must not
 * fail the poll or the Helius reply. A charge with no webhook URL sends nothing.
 */
export async function sendFlipWebhook(flipped: Charge, merchant: Merchant): Promise<void> {
  const type = eventTypeFor(flipped.status);
  if (!type || !flipped.webhookUrl) return;
  try {
    await deliverWebhook(flipped, merchant, await getSplitMint(merchant.splitConfig), type);
  } catch (error) {
    console.error(`Webhook for ${flipped.id} could not be recorded: ${error instanceof Error ? error.name : 'error'}`);
  }
}

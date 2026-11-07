import { randomBytes } from 'node:crypto';
import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

/** Contracts §6. Amounts are base units in a `numeric`, read back as strings (never floats). */

export const CHARGE_STATUSES = ['pending', 'paid', 'paid_late', 'expired'] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

/** `mch_…` / `ch_…` ids: a prefix and 12 random bytes. */
export function newId(prefix: 'mch' | 'ch'): string {
  return `${prefix}_${randomBytes(12).toString('hex')}`;
}

export const merchants = pgTable('merchants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** The SplitConfig account address, base58. */
  splitConfig: text('split_config').notNull(),
  /** SHA-256 hex of the API key; the key itself is never stored. */
  apiKeyHash: text('api_key_hash').notNull().unique(),
  webhookSecret: text('webhook_secret').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const charges = pgTable(
  'charges',
  {
    id: text('id').primaryKey(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id),
    reference: text('reference').notNull().unique(),
    amount: numeric('amount', { precision: 20, scale: 0 }).notNull(),
    orderId: text('order_id').notNull(),
    webhookUrl: text('webhook_url'),
    successUrl: text('success_url'),
    status: text('status', { enum: CHARGE_STATUSES }).notNull().default('pending'),
    payer: text('payer'),
    signature: text('signature').unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('charges_merchant_order_unique').on(table.merchantId, table.orderId)],
);

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: text('id').primaryKey(),
    chargeId: text('charge_id')
      .notNull()
      .references(() => charges.id),
    eventType: text('event_type').notNull(),
    statusCode: integer('status_code'),
    error: text('error'),
    attempt: integer('attempt').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('webhook_deliveries_charge_idx').on(table.chargeId)],
);

export type Merchant = typeof merchants.$inferSelect;
export type Charge = typeof charges.$inferSelect;

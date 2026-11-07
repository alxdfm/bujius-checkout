import { toBaseUnits } from '@bujius/checkout-sdk';
import { z } from 'zod';

export const USDC_DECIMALS = 6;
export const DEFAULT_EXPIRES_IN_SECONDS = 900;

const httpsUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'must be an https URL');

/**
 * `POST /v1/charges` is strict (contracts §6): a wallet, recipients, a config or a mint — any
 * field not listed here — is a 400. Who gets paid comes from the merchant's `split_config`.
 */
export const createChargeBody = z
  .object({
    amount: z
      .string()
      .refine((value) => {
        try {
          return toBaseUnits(value, USDC_DECIMALS) > 0n;
        } catch {
          return false;
        }
      }, 'must be a positive decimal such as "12.50" with at most 6 decimals')
      .transform((value) => toBaseUnits(value, USDC_DECIMALS)),
    orderId: z.string().min(1).max(128),
    webhookUrl: httpsUrl.optional(),
    successUrl: httpsUrl.optional(),
    expiresInSeconds: z.number().int().min(60).max(3600).default(DEFAULT_EXPIRES_IN_SECONDS),
  })
  .strict();

export type CreateChargeBody = z.infer<typeof createChargeBody>;

/** One English sentence for the first problem; never echoes a value, only field names. */
export function describeIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'The body is not valid.';
  if (issue.code === 'unrecognized_keys') {
    return `Unknown field: ${issue.keys.join(', ')}. Who gets paid comes from your split config.`;
  }
  const path = issue.path.join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}

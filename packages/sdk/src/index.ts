// Public exports — append-only; each track appends its own lines (PLAN.md §4).
export { BujiusCheckoutError, ErrorCode, isBujiusCheckoutError } from './errors';
export { findSplitConfig, PROGRAM_ID } from './program/pda';
export { fetchSplitConfig } from './program/config';
export type { Recipient, SplitConfig } from './program/config';
export { buildCreateSplit } from './program/create-split';
// Track B — core helpers (B1)
export { toBaseUnits, fromBaseUnits } from './core/amounts';
export { newReference } from './core/reference';
export { paymentUrl } from './core/url';
export { computeSplit } from './core/split-math';
export { buildSplitPayment } from './strategies/transfers';
export type { PaymentStrategy } from './strategies/transfers';
export { findPayment } from './verify/find-payment';

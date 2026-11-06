// Public exports — append-only; each track appends its own lines (PLAN.md §4).
export { BujiusCheckoutError, ErrorCode, isBujiusCheckoutError } from './errors';
export { findSplitConfig, PROGRAM_ID } from './program/pda';
export { fetchSplitConfig } from './program/config';
export type { Recipient, SplitConfig } from './program/config';
export { buildCreateSplit } from './program/create-split';

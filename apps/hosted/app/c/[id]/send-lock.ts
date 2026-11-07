/**
 * After a wallet sends, the status route sees nothing until the transaction confirms, so a new
 * transaction now could pay the charge twice. The blockhash of the one sent dies within about 90
 * seconds: past that it can no longer land, and paying again is safe.
 */
export const SEND_WINDOW_MS = 90_000;

/** A send "in the future" is a clock that moved back: it must not lock the page until the expiry. */
export const isSendInFlight = (sentAt: number | null, now: number) =>
  sentAt !== null && sentAt <= now && now - sentAt < SEND_WINDOW_MS;

/** The latest of the two: a failed write leaves an older time in storage, and memory has the real one. */
export function latestSentAt(stored: number | null, inMemory: number | null): number | null {
  if (stored === null || inMemory === null) {
    return stored ?? inMemory;
  }
  return Math.max(stored, inMemory);
}

/** The saved time of a send, or `null`: this text comes from the browser's storage. */
export function parseSentAt(raw: string | null): number | null {
  const sentAt = Number(raw);
  return raw !== null && Number.isSafeInteger(sentAt) && sentAt > 0 ? sentAt : null;
}

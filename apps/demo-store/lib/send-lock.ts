/**
 * After a wallet sends, `findPayment` sees nothing until the transaction confirms, so a new
 * transaction now could pay the order twice. The blockhash of the one sent dies within about 90
 * seconds: past that it can no longer land, and paying again is safe.
 */
export const SEND_WINDOW_MS = 90_000;

export const isSendInFlight = (sentAt: number | null, now: number) =>
  sentAt !== null && now - sentAt < SEND_WINDOW_MS;

/** The saved time of a send, or `null`: this text comes from the browser's storage. */
export function parseSentAt(raw: string | null): number | null {
  const sentAt = Number(raw);
  return raw !== null && Number.isSafeInteger(sentAt) && sentAt > 0 ? sentAt : null;
}

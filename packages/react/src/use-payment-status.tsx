import { useEffect, useState } from 'react';

export type PaymentStatus = 'pending' | 'paid' | 'paid_late' | 'expired' | 'invalid';

export interface PaymentStatusState {
  status: PaymentStatus;
  signature: string | null;
  /** The last poll failed. Polling goes on, so this clears by itself. */
  error: string | null;
}

const INITIAL: PaymentStatusState = { status: 'pending', signature: null, error: null };
const STATUSES: readonly PaymentStatus[] = ['pending', 'paid', 'paid_late', 'expired', 'invalid'];
const POLL_FAILED = 'We could not check this payment. Still trying.';

const isFinal = (status: PaymentStatus) => status !== 'pending';

/** Reads one status. Whatever it says comes from the route: the browser never decides paid. */
export async function readPaymentStatus(
  statusUrl: string,
  signal?: AbortSignal,
): Promise<PaymentStatusState> {
  const response = await fetch(statusUrl, { signal, cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Status route answered ${response.status}`);
  }
  const body = (await response.json()) as { status?: PaymentStatus; signature?: string } | null;
  if (!body?.status || !STATUSES.includes(body.status)) {
    throw new Error('Status route answered an unknown status');
  }
  return { status: body.status, signature: body.signature ?? null, error: null };
}

/** Polls until `paid`, `paid_late`, `expired` or `invalid`. One request at a time. */
export function usePaymentStatus(statusUrl: string, intervalMs = 2000): PaymentStatusState {
  const [state, setState] = useState(INITIAL);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    setState(INITIAL);

    async function poll() {
      try {
        const next = await readPaymentStatus(statusUrl, controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        setState(next);
        if (isFinal(next.status)) {
          return;
        }
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        setState((current) => ({ ...current, error: POLL_FAILED }));
      }
      timer = setTimeout(poll, intervalMs);
    }

    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [statusUrl, intervalMs]);

  return state;
}

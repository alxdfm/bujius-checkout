import type { Charge, ChargeStatus } from './charge';

/** Stands in for `GET /v1/charges/:id/status` until `A9` lands. Deleted when it does. */
interface MockCharge {
  status: ChargeStatus;
  successUrl?: string;
  /** Answers `pending` for this long after the first read, then `status`. */
  pendingForMs?: number;
}

const FLIP_MS = 15_000;
const CHARGE_SECONDS = 900;

const MOCKS: Record<string, MockCharge> = {
  ch_mock_pending: { status: 'pending' },
  ch_mock_flip: { status: 'paid', pendingForMs: FLIP_MS },
  ch_mock_flip_redirect: { status: 'paid', pendingForMs: FLIP_MS, successUrl: 'https://example.com/thanks' },
  ch_mock_flip_expired: { status: 'expired', pendingForMs: FLIP_MS },
  ch_mock_paid: { status: 'paid' },
  ch_mock_paid_redirect: { status: 'paid', successUrl: 'https://example.com/thanks' },
  ch_mock_paid_unsafe_redirect: { status: 'paid', successUrl: 'javascript:alert(1)' },
  ch_mock_paid_late: { status: 'paid_late' },
  ch_mock_expired: { status: 'expired' },
};

// On `globalThis`: the page and the route handler are separate bundles.
const memory = globalThis as typeof globalThis & { mockFirstRead?: Map<string, number> };
const firstRead = (memory.mockFirstRead ??= new Map<string, number>());

/** `null` for an unknown id and always in production: a mock must never show a real payer `Paid`. */
export function readMockCharge(id: string): Charge | null {
  const mock = Object.hasOwn(MOCKS, id) ? MOCKS[id] : undefined;
  if (!mock || process.env.NODE_ENV === 'production') {
    return null;
  }
  const now = Date.now();
  const startedAt = firstRead.get(id) ?? now;
  firstRead.set(id, startedAt);

  const status = mock.pendingForMs && now - startedAt < mock.pendingForMs ? 'pending' : mock.status;
  const settled = status === 'paid' || status === 'paid_late';
  return {
    status,
    signature: settled ? 'MockSignature' : null,
    reference: 'MockReference',
    amount: '12500000',
    expiresAt: new Date(startedAt + CHARGE_SECONDS * 1000).toISOString(),
    successUrl: mock.successUrl ?? null,
  };
}

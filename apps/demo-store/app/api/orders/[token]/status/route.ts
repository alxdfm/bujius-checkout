import { isBujiusCheckoutError } from '@bujius/checkout-sdk';
import { isNetworkBusy, readOrderStatus } from '@/lib/order-status';
import { readOrderToken } from '@/lib/order-token';
import { getStoreChain } from '@/lib/store-chain';
import { readStoreEnv } from '@/lib/store-env';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Names a missing env var, and never prints the RPC URL with its key. */
function describeFailure(error: unknown): string {
  if (isBujiusCheckoutError(error)) {
    return error.code;
  }
  return error instanceof Error
    ? `${error.name}: ${error.message.replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<url>')}`
    : 'unknown error';
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  try {
    const order = readOrderToken(token, readStoreEnv().orderSecret);
    if (!order) {
      return Response.json({ error: 'This order does not exist.' }, { status: 404, headers: NO_STORE });
    }
    const result = await readOrderStatus(getStoreChain(), order, Math.floor(Date.now() / 1000));
    return Response.json(
      { status: result.status, ...('signature' in result ? { signature: result.signature } : {}) },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (isNetworkBusy(error)) {
      return Response.json({ error: 'The network is busy. Try again in a moment.' }, { status: 503, headers: NO_STORE });
    }
    console.error(`Status route failed: ${describeFailure(error)}`);
    return Response.json({ error: 'We could not check this order.' }, { status: 500, headers: NO_STORE });
  }
}

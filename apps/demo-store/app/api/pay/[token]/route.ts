import { createTransactionRequestHandler } from '@bujius/checkout-sdk';
import { createOrderResolver } from '@/lib/resolve-order';
import { getStoreChain } from '@/lib/store-chain';
import { readStoreEnv } from '@/lib/store-env';

export const dynamic = 'force-dynamic';

type Handler = (request: Request) => Promise<Response>;

let handler: Handler | undefined;

function getHandler(): Handler {
  if (handler) {
    return handler;
  }
  const { baseUrl, orderSecret, strategy } = readStoreEnv();
  const { connection, loadConfig } = getStoreChain();

  handler = createTransactionRequestHandler({
    connection,
    label: 'Demo Store',
    iconUrl: `${baseUrl}/icon.svg`,
    strategy,
    resolve: createOrderResolver({ connection, orderSecret, loadConfig }),
  });
  return handler;
}

/**
 * A deployment missing an env var cannot build the SDK handler. It must still answer with the
 * CORS headers (contracts §4), or the wallet fails silently and the QR just does nothing.
 */
function unconfigured(error: unknown): Response {
  console.error(error instanceof Error ? error.message : 'The store is not configured');
  return Response.json(
    { error: 'This order cannot be paid. Go back to the store.' },
    {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    },
  );
}

async function handle(request: Request): Promise<Response> {
  let current: Handler;
  try {
    current = getHandler();
  } catch (error) {
    return unconfigured(error);
  }
  return current(request);
}

export { handle as GET, handle as POST, handle as OPTIONS };

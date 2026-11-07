import { readMockCharge } from '../mock-charges';

export const dynamic = 'force-dynamic';

/** The mock's `GET /v1/charges/:id/status`, for the panel to poll. Deleted when `A9` lands. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const charge = readMockCharge((await params).id);
  if (!charge) {
    return Response.json(
      { error: { code: 'CHARGE_NOT_FOUND', message: 'This charge does not exist.' } },
      { status: 404 },
    );
  }
  return Response.json(charge);
}

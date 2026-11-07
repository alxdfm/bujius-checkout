/** Contracts §6: every error is `{ "error": { "code", "message" } }`. */
export function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

export const unauthorized = (): Response =>
  errorResponse(401, 'UNAUTHORIZED', 'Send your API key as "Authorization: Bearer sk_test_…".');

export const chargeNotFound = (): Response =>
  errorResponse(404, 'CHARGE_NOT_FOUND', 'No charge with this id.');

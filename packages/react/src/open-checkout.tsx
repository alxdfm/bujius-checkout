/** The hosted checkout's entry point: a plain redirect. */
export function openCheckout(checkoutUrl: string): void {
  window.location.assign(checkoutUrl);
}

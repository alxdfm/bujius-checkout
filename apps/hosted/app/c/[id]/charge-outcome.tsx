/** A state with one sentence and no way out: a charge does not say where its store is. */
export function Notice({ title, text }: { title: string; text: string }) {
  return (
    <>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-zinc-600">{text}</p>
    </>
  );
}

export const ChargeNotFound = () => <Notice title="Charge not found" text="This charge does not exist." />;

export const ChargeExpired = () => (
  <Notice title="Charge expired" text="This charge expired. Go back to the store and start again." />
);

/** Only ever rendered from the status route's answer. */
export function ChargePaid({ late, signature }: { late: boolean; signature: string | null }) {
  return (
    <>
      <Notice
        title={late ? 'Paid after the expiry' : 'Paid'}
        text={
          late
            ? 'Your payment landed after this charge expired. It is recorded. Contact the store about your order.'
            : 'Your payment is confirmed. You can close this page.'
        }
      />
      {signature && (
        <a
          href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block text-sm underline"
        >
          See the transaction on the explorer
        </a>
      )}
    </>
  );
}

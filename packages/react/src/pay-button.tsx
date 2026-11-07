import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Transaction, type PublicKey } from '@solana/web3.js';
import { useRef, useState } from 'react';

/**
 * The handler's codes as the status tells them, plus what can only go wrong in the browser. A
 * Solana Pay endpoint answers a sentence, not a code, so `onError` also gets that sentence.
 */
export type PayErrorCode =
  | 'INVALID_ACCOUNT'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_HELD'
  | 'ORDER_PAID'
  | 'ORDER_EXPIRED'
  | 'RPC_UNAVAILABLE'
  | 'REQUEST_FAILED'
  | 'WALLET_FAILED';

export interface PayButtonProps {
  /** The handler's HTTPS URL: the button asks it for the transaction, it never builds one. */
  transactionRequestUrl: string;
  /** The wallet sent the transaction. That is not paid: only the status route decides. */
  onSigned: (signature: string) => void;
  onError: (code: PayErrorCode, sentence: string) => void;
  label?: string;
  className?: string;
}

const REQUEST_FAILED = 'We could not reach the store. Try again.';
// A send can fail after the broadcast, so this never claims that nothing went out.
const WALLET_FAILED = 'Your wallet could not confirm this payment. Check your wallet before trying again.';
// Only covers the endpoint: signing has no time limit, the payer may take as long as they need.
const REQUEST_TIMEOUT_MS = 20_000;

class PayError extends Error {
  constructor(
    readonly code: PayErrorCode,
    sentence: string,
  ) {
    super(sentence);
  }
}

function codeOf(status: number, sentence: string): PayErrorCode {
  switch (status) {
    case 400:
      return 'INVALID_ACCOUNT';
    case 404:
      return 'ORDER_NOT_FOUND';
    case 409:
      return sentence === 'This order is already paid.' ? 'ORDER_PAID' : 'ORDER_HELD';
    case 410:
      return 'ORDER_EXPIRED';
    case 503:
      return 'RPC_UNAVAILABLE';
    default:
      return 'REQUEST_FAILED';
  }
}

/** Plain transaction request: it works against any Solana Pay endpoint. */
export async function requestTransaction(url: string, account: PublicKey): Promise<Transaction> {
  let response: Response;
  let body: { transaction?: unknown; error?: unknown };
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: account.toBase58() }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    body = ((await response.json()) ?? {}) as typeof body;
  } catch {
    throw new PayError('REQUEST_FAILED', REQUEST_FAILED);
  }
  if (!response.ok) {
    const sentence = typeof body.error === 'string' ? body.error : REQUEST_FAILED;
    throw new PayError(codeOf(response.status, sentence), sentence);
  }
  try {
    const bytes = Uint8Array.from(atob(body.transaction as string), (c) => c.charCodeAt(0));
    return Transaction.from(bytes);
  } catch {
    throw new PayError('REQUEST_FAILED', REQUEST_FAILED);
  }
}

/**
 * Not connected: opens the modal. Connected: asks the endpoint, then the wallet to sign and send.
 * Once the wallet has sent, this URL stays locked: `findPayment` sees nothing until the transaction
 * confirms, so another click would build a second valid payment.
 */
export function PayButton({ transactionRequestUrl, onSigned, onError, label, className }: PayButtonProps) {
  const { connection } = useConnection();
  const { publicKey, wallet, connecting, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const [paying, setPaying] = useState(false);
  const [sentFor, setSentFor] = useState<string | null>(null);
  // The ref closes the gap before the next render disables the button.
  const lockedFor = useRef<string | null>(null);
  const sent = sentFor === transactionRequestUrl;

  async function pay() {
    if (!publicKey) {
      setVisible(true);
      return;
    }
    if (lockedFor.current === transactionRequestUrl) {
      return;
    }
    lockedFor.current = transactionRequestUrl;
    setPaying(true);
    let signature: string;
    try {
      const transaction = await requestTransaction(transactionRequestUrl, publicKey);
      try {
        signature = await sendTransaction(transaction, connection);
      } catch {
        throw new PayError('WALLET_FAILED', WALLET_FAILED);
      }
    } catch (error) {
      lockedFor.current = null;
      setPaying(false);
      if (error instanceof PayError) {
        onError(error.code, error.message);
      } else {
        onError('REQUEST_FAILED', REQUEST_FAILED);
      }
      return;
    }
    setSentFor(transactionRequestUrl);
    setPaying(false);
    // Outside the try: a callback that throws must never tell the payer to pay again.
    onSigned(signature);
  }

  const text = sent
    ? 'Payment sent. Checking…'
    : paying
      ? 'Waiting for your wallet…'
      : connecting
        ? 'Connecting…'
        : (label ?? (wallet && publicKey ? `Pay with ${wallet.adapter.name}` : 'Pay with a wallet'));

  // `connecting` does not disable it: a wallet that never answers must not leave the payer stuck.
  return (
    <button type="button" onClick={pay} disabled={paying || sent} className={className}>
      {text}
    </button>
  );
}

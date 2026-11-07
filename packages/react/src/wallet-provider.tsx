import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';
import type { ReactNode } from 'react';

export interface BujiusCheckoutWalletProviderProps {
  /** The RPC the browser sends through: never one that carries a key. */
  endpoint: string;
  children: ReactNode;
}

// Empty on purpose: wallets arrive through Wallet Standard discovery, never a hard-coded list.
const NO_LEGACY_WALLETS: never[] = [];

/** The connection, the wallet adapter and its modal. `autoConnect` is what connects a wallet picked in the modal. */
export function BujiusCheckoutWalletProvider({ endpoint, children }: BujiusCheckoutWalletProviderProps) {
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={NO_LEGACY_WALLETS} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

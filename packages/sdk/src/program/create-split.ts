import { BorshInstructionCoder, type Idl } from '@coral-xyz/anchor';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type Connection,
  type PublicKey,
} from '@solana/web3.js';
import type { Recipient } from './config';
import idl from './idl.json';
import { findSplitConfig, PROGRAM_ID } from './pda';

const coder = new BorshInstructionCoder(idl as Idl);

/**
 * Unsigned transaction: creates every destination ATA (merchant and recipients, paid by the
 * merchant), then `create_split`. Fee payer = authority.
 */
export async function buildCreateSplit(
  connection: Connection,
  authority: PublicKey,
  id: number,
  mint: PublicKey,
  recipients: Recipient[],
): Promise<Transaction> {
  const tx = new Transaction();
  for (const owner of [authority, ...recipients.map((r) => r.wallet)]) {
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        authority,
        getAssociatedTokenAddressSync(mint, owner),
        owner,
        mint,
      ),
    );
  }
  tx.add(
    new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: findSplitConfig(authority, id), isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: coder.encode('create_split', { id, recipients }),
    }),
  );
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.feePayer = authority;
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  return tx;
}

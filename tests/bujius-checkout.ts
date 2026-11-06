import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { BujiusCheckout } from "../target/types/bujius_checkout";

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const MINT_SIZE = 82;

describe("bujius-checkout · create_split", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.bujiusCheckout as Program<BujiusCheckout>;
  const authority = (provider.wallet as anchor.Wallet).payer;

  let mint: PublicKey;
  let nextId = 1;

  // Creates a classic SPL Token mint without extra dependencies
  async function createMint(): Promise<PublicKey> {
    const kp = Keypair.generate();
    const rent = await provider.connection.getMinimumBalanceForRentExemption(
      MINT_SIZE
    );
    const data = Buffer.concat([
      Buffer.from([20, 6]), // InitializeMint2, 6 decimals
      authority.publicKey.toBuffer(),
      Buffer.from([0]), // no freeze authority
    ]);
    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: authority.publicKey,
        newAccountPubkey: kp.publicKey,
        lamports: rent,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      new TransactionInstruction({
        programId: TOKEN_PROGRAM_ID,
        keys: [{ pubkey: kp.publicKey, isSigner: false, isWritable: true }],
        data,
      })
    );
    await provider.sendAndConfirm(tx, [kp]);
    return kp.publicKey;
  }

  function configPda(id: number): PublicKey {
    const idBytes = Buffer.alloc(2);
    idBytes.writeUInt16LE(id);
    return PublicKey.findProgramAddressSync(
      [Buffer.from("split"), authority.publicKey.toBuffer(), idBytes],
      program.programId
    )[0];
  }

  async function create(
    id: number,
    recipients: { wallet: PublicKey; bps: number }[]
  ) {
    return program.methods
      .createSplit(id, recipients)
      .accountsPartial({
        authority: authority.publicKey,
        config: configPda(id),
        mint,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async function expectError(promise: Promise<unknown>, code: string) {
    try {
      await promise;
    } catch (e: any) {
      expect(e.error?.errorCode?.code ?? String(e)).to.equal(code);
      return;
    }
    expect.fail(`expected ${code}`);
  }

  const wallet = () => Keypair.generate().publicKey;

  before(async () => {
    mint = await createMint();
  });

  it("creates a config and reads back every field", async () => {
    const id = nextId++;
    const a = wallet();
    const b = wallet();
    await create(id, [
      { wallet: a, bps: 1000 },
      { wallet: b, bps: 250 },
    ]);

    const config = await program.account.splitConfig.fetch(configPda(id));
    expect(config.authority.toBase58()).to.equal(authority.publicKey.toBase58());
    expect(config.id).to.equal(id);
    expect(config.mint.toBase58()).to.equal(mint.toBase58());
    expect(config.recipients).to.have.length(2);
    expect(config.recipients[0].wallet.toBase58()).to.equal(a.toBase58());
    expect(config.recipients[0].bps).to.equal(1000);
    expect(config.recipients[1].wallet.toBase58()).to.equal(b.toBase58());
    expect(config.recipients[1].bps).to.equal(250);
    const [, bump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("split"),
        authority.publicKey.toBuffer(),
        Buffer.from([id, 0]),
      ],
      program.programId
    );
    expect(config.bump).to.equal(bump);
  });

  it("allocates 215 bytes at the PDA from the seeds", async () => {
    const id = nextId++;
    await create(id, [{ wallet: wallet(), bps: 100 }]);
    const info = await provider.connection.getAccountInfo(configPda(id));
    expect(info!.data.length).to.equal(215);
    expect(info!.owner.toBase58()).to.equal(program.programId.toBase58());
  });

  it("accepts 4 recipients adding up to exactly 10 000 bps", async () => {
    const id = nextId++;
    await create(id, [
      { wallet: wallet(), bps: 2500 },
      { wallet: wallet(), bps: 2500 },
      { wallet: wallet(), bps: 2500 },
      { wallet: wallet(), bps: 2500 },
    ]);
    const config = await program.account.splitConfig.fetch(configPda(id));
    expect(config.recipients).to.have.length(4);
  });

  it("rejects zero recipients with InvalidRecipientCount", async () => {
    await expectError(create(nextId++, []), "InvalidRecipientCount");
  });

  it("rejects 5 recipients with InvalidRecipientCount", async () => {
    const five = Array.from({ length: 5 }, () => ({ wallet: wallet(), bps: 100 }));
    await expectError(create(nextId++, five), "InvalidRecipientCount");
  });

  it("rejects a zero bps with ZeroBps", async () => {
    await expectError(
      create(nextId++, [{ wallet: wallet(), bps: 0 }]),
      "ZeroBps"
    );
  });

  it("rejects bps above 10 000 with SplitOverflow", async () => {
    await expectError(
      create(nextId++, [
        { wallet: wallet(), bps: 6000 },
        { wallet: wallet(), bps: 4001 },
      ]),
      "SplitOverflow"
    );
  });

  it("rejects repeated wallets with DuplicateRecipient", async () => {
    const dup = wallet();
    await expectError(
      create(nextId++, [
        { wallet: dup, bps: 100 },
        { wallet: dup, bps: 100 },
      ]),
      "DuplicateRecipient"
    );
  });

  it("rejects the merchant as a recipient with DuplicateRecipient", async () => {
    await expectError(
      create(nextId++, [{ wallet: authority.publicKey, bps: 100 }]),
      "DuplicateRecipient"
    );
  });

  it("cannot create the same config twice", async () => {
    const id = nextId++;
    await create(id, [{ wallet: wallet(), bps: 100 }]);
    let failed = false;
    try {
      await create(id, [{ wallet: wallet(), bps: 200 }]);
    } catch {
      failed = true;
    }
    expect(failed).to.equal(true);
  });
});

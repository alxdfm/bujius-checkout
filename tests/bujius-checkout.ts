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

  describe("pay", () => {
    const ATA_PROGRAM = new PublicKey(
      "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
    );
    let payMint: PublicKey;

    const ata = (owner: PublicKey, m = payMint) =>
      PublicKey.findProgramAddressSync(
        [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), m.toBuffer()],
        ATA_PROGRAM
      )[0];

    // Creates the ATAs (idempotent) and optionally mints to the first owner
    async function setupAtas(owners: PublicKey[], m: PublicKey, mintTo?: bigint) {
      const tx = new Transaction();
      for (const owner of owners) {
        tx.add(
          new TransactionInstruction({
            programId: ATA_PROGRAM,
            keys: [
              { pubkey: authority.publicKey, isSigner: true, isWritable: true },
              { pubkey: ata(owner, m), isSigner: false, isWritable: true },
              { pubkey: owner, isSigner: false, isWritable: false },
              { pubkey: m, isSigner: false, isWritable: false },
              { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
              { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            ],
            data: Buffer.from([1]),
          })
        );
      }
      if (mintTo) {
        const data = Buffer.alloc(9);
        data[0] = 7; // MintTo
        data.writeBigUInt64LE(mintTo, 1);
        tx.add(
          new TransactionInstruction({
            programId: TOKEN_PROGRAM_ID,
            keys: [
              { pubkey: m, isSigner: false, isWritable: true },
              { pubkey: ata(owners[0], m), isSigner: false, isWritable: true },
              { pubkey: authority.publicKey, isSigner: true, isWritable: false },
            ],
            data,
          })
        );
      }
      await provider.sendAndConfirm(tx);
    }

    const balance = async (owner: PublicKey) =>
      BigInt(
        (await provider.connection.getTokenAccountBalance(ata(owner))).value.amount
      );

    // A fresh config with its recipients; the payer (authority) is funded
    async function scenario(bps: number[]) {
      const id = nextId++;
      const recipients = bps.map((b) => ({ wallet: wallet(), bps: b }));
      mint = payMint;
      await create(id, recipients);
      await setupAtas(
        [authority.publicKey, ...recipients.map((r) => r.wallet)],
        payMint,
        100_000_000n
      );
      return { id, recipients };
    }

    function pay(
      id: number,
      amount: bigint,
      rest: PublicKey[],
      overrides: Partial<{ mint: PublicKey; merchantToken: PublicKey }> = {}
    ) {
      return program.methods
        .pay(new anchor.BN(amount.toString()))
        .accountsPartial({
          payer: authority.publicKey,
          payerToken: ata(authority.publicKey),
          config: configPda(id),
          mint: overrides.mint ?? payMint,
          merchantToken: overrides.merchantToken ?? ata(authority.publicKey),
          reference: wallet(),
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts(
          rest.map((pubkey) => ({ pubkey, isSigner: false, isWritable: true }))
        )
        .rpc();
    }

    before(async () => {
      payMint = await createMint();
    });

    // Vectors of contracts §2: [amount, bps, shares, merchant]
    const vectors: [bigint, number[], bigint[], bigint][] = [
      [1_000_000n, [500], [50_000n], 950_000n],
      [1_000_001n, [333, 333], [33_300n, 33_300n], 933_401n],
      [1n, [500], [0n], 1n],
      [10_000n, [10_000], [10_000n], 0n],
    ];
    for (const [amount, bps, shares, merchant] of vectors) {
      it(`splits ${amount} over [${bps}] and keeps the invariant`, async () => {
        const { id, recipients } = await scenario(bps);
        const before = await balance(authority.publicKey);
        await pay(id, amount, recipients.map((r) => ata(r.wallet)));
        for (let i = 0; i < recipients.length; i++) {
          expect(await balance(recipients[i].wallet)).to.equal(shares[i]);
        }
        const merchantDelta = (await balance(authority.publicKey)) - before;
        // the payer is the merchant here: net change is -(amount - merchant)
        expect(merchantDelta).to.equal(merchant - amount);
        expect(merchant + shares.reduce((a, b) => a + b, 0n)).to.equal(amount);
      });
    }

    it("rejects a zero amount with ZeroAmount", async () => {
      const { id, recipients } = await scenario([500]);
      await expectError(pay(id, 0n, recipients.map((r) => ata(r.wallet))), "ZeroAmount");
    });

    it("rejects another mint with MintMismatch", async () => {
      const { id, recipients } = await scenario([500]);
      const other = await createMint();
      await expectError(
        pay(id, 1000n, recipients.map((r) => ata(r.wallet)), { mint: other }),
        "MintMismatch"
      );
    });

    it("rejects a wrong merchant token account with BadTokenAccount", async () => {
      const { id, recipients } = await scenario([500]);
      await expectError(
        pay(id, 1000n, recipients.map((r) => ata(r.wallet)), {
          merchantToken: ata(recipients[0].wallet),
        }),
        "BadTokenAccount"
      );
    });

    it("rejects a missing recipient with RecipientCountMismatch", async () => {
      const { id, recipients } = await scenario([500, 300]);
      await expectError(
        pay(id, 1000n, [ata(recipients[0].wallet)]),
        "RecipientCountMismatch"
      );
    });

    it("rejects recipients in the wrong order with BadTokenAccount", async () => {
      const { id, recipients } = await scenario([500, 300]);
      await expectError(
        pay(id, 1000n, [ata(recipients[1].wallet), ata(recipients[0].wallet)]),
        "BadTokenAccount"
      );
    });
  });
});

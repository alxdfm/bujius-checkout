use anchor_lang::prelude::*;

declare_id!("LNv2EvYZFN1fBJeQPDGffRxVYPMCGpa99yCcWDSDdjN");

#[program]
pub mod bujius_checkout {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

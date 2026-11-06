use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;
use state::Recipient;

declare_id!("LNv2EvYZFN1fBJeQPDGffRxVYPMCGpa99yCcWDSDdjN");

#[program]
pub mod bujius_checkout {
    use super::*;

    pub fn create_split(
        ctx: Context<CreateSplit>,
        id: u16,
        recipients: Vec<Recipient>,
    ) -> Result<()> {
        instructions::create_split::handler(ctx, id, recipients)
    }
}

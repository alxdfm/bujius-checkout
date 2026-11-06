use anchor_lang::prelude::*;

pub const MAX_RECIPIENTS: usize = 4;
pub const SPLIT_SEED: &[u8] = b"split";

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Recipient {
    pub wallet: Pubkey,
    pub bps: u16,
}

/// One per merchant per `id`; immutable after creation.
#[account]
#[derive(InitSpace)]
pub struct SplitConfig {
    pub authority: Pubkey,
    pub id: u16,
    pub mint: Pubkey,
    #[max_len(MAX_RECIPIENTS)]
    pub recipients: Vec<Recipient>,
    pub bump: u8,
}

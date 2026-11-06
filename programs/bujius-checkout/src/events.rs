use anchor_lang::prelude::*;

use crate::state::Recipient;

#[event]
pub struct SplitCreated {
    pub config: Pubkey,
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub recipients: Vec<Recipient>,
}

#[event]
pub struct SplitPaid {
    pub config: Pubkey,
    pub payer: Pubkey,
    pub mint: Pubkey,
    pub reference: Pubkey,
    pub amount: u64,
    pub merchant_amount: u64,
    pub shares: Vec<u64>,
    pub ts: i64,
}

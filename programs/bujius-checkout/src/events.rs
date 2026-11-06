use anchor_lang::prelude::*;

use crate::state::Recipient;

#[event]
pub struct SplitCreated {
    pub config: Pubkey,
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub recipients: Vec<Recipient>,
}

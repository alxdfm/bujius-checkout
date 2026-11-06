use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::errors::BujiusError;
use crate::events::SplitCreated;
use crate::state::{Recipient, SplitConfig, MAX_RECIPIENTS, SPLIT_SEED};

#[derive(Accounts)]
#[instruction(id: u16)]
pub struct CreateSplit<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + SplitConfig::INIT_SPACE,
        seeds = [SPLIT_SEED, authority.key().as_ref(), &id.to_le_bytes()],
        bump
    )]
    pub config: Account<'info, SplitConfig>,
    /// Classic SPL Token mint only (Token-2022 is out of scope).
    pub mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateSplit>, id: u16, recipients: Vec<Recipient>) -> Result<()> {
    let authority = ctx.accounts.authority.key();

    require!(
        (1..=MAX_RECIPIENTS).contains(&recipients.len()),
        BujiusError::InvalidRecipientCount
    );

    let mut total: u32 = 0;
    for (i, r) in recipients.iter().enumerate() {
        require!(r.bps >= 1, BujiusError::ZeroBps);
        total += r.bps as u32;
        require!(r.wallet != authority, BujiusError::DuplicateRecipient);
        require!(
            !recipients[..i].iter().any(|p| p.wallet == r.wallet),
            BujiusError::DuplicateRecipient
        );
    }
    require!(total <= 10_000, BujiusError::SplitOverflow);

    let config = &mut ctx.accounts.config;
    config.authority = authority;
    config.id = id;
    config.mint = ctx.accounts.mint.key();
    config.recipients = recipients.clone();
    config.bump = ctx.bumps.config;

    emit!(SplitCreated {
        config: config.key(),
        authority,
        mint: config.mint,
        recipients,
    });
    Ok(())
}

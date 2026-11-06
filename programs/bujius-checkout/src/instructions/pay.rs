use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked};

use crate::errors::BujiusError;
use crate::events::SplitPaid;
use crate::state::SplitConfig;

const BPS_DENOMINATOR: u128 = 10_000;

#[derive(Accounts)]
pub struct Pay<'info> {
    pub payer: Signer<'info>,
    #[account(
        mut,
        token::authority = payer,
        constraint = payer_token.mint == config.mint @ BujiusError::MintMismatch
    )]
    pub payer_token: Account<'info, TokenAccount>,
    pub config: Account<'info, SplitConfig>,
    #[account(address = config.mint @ BujiusError::MintMismatch)]
    pub mint: Account<'info, Mint>,
    /// CHECK: verified in the handler against ATA(config.authority, mint)
    #[account(mut)]
    pub merchant_token: UncheckedAccount<'info>,
    /// CHECK: the Solana Pay reference; read-only, never a signer, not inspected
    pub reference: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handler<'info>(ctx: Context<'_, '_, 'info, 'info, Pay<'info>>, amount: u64) -> Result<()> {
    require!(amount > 0, BujiusError::ZeroAmount);

    let config = &ctx.accounts.config;
    let mint_key = ctx.accounts.mint.key();
    let recipients = &config.recipients;

    require!(
        ctx.accounts.merchant_token.key()
            == get_associated_token_address(&config.authority, &mint_key),
        BujiusError::BadTokenAccount
    );
    require!(
        ctx.remaining_accounts.len() == recipients.len(),
        BujiusError::RecipientCountMismatch
    );

    // Compute every share first: floor(amount * bps / 10 000) in 128 bits
    let mut shares: Vec<u64> = Vec::with_capacity(recipients.len());
    let mut total: u64 = 0;
    for (i, r) in recipients.iter().enumerate() {
        require!(
            ctx.remaining_accounts[i].key() == get_associated_token_address(&r.wallet, &mint_key),
            BujiusError::BadTokenAccount
        );
        let share = (amount as u128)
            .checked_mul(r.bps as u128)
            .and_then(|v| v.checked_div(BPS_DENOMINATOR))
            .and_then(|v| u64::try_from(v).ok())
            .ok_or(BujiusError::MathOverflow)?;
        total = total.checked_add(share).ok_or(BujiusError::MathOverflow)?;
        shares.push(share);
    }
    let merchant_amount = amount.checked_sub(total).ok_or(BujiusError::MathOverflow)?;

    let decimals = ctx.accounts.mint.decimals;
    let transfer = |to: AccountInfo<'info>, value: u64| -> Result<()> {
        if value == 0 {
            return Ok(()); // a zero leg is skipped
        }
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.payer_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to,
                    authority: ctx.accounts.payer.to_account_info(),
                },
            ),
            value,
            decimals,
        )
    };

    for (i, share) in shares.iter().enumerate() {
        transfer(ctx.remaining_accounts[i].clone(), *share)?;
    }
    transfer(
        ctx.accounts.merchant_token.to_account_info(),
        merchant_amount,
    )?;

    emit!(SplitPaid {
        config: config.key(),
        payer: ctx.accounts.payer.key(),
        mint: mint_key,
        reference: ctx.accounts.reference.key(),
        amount,
        merchant_amount,
        shares,
        ts: Clock::get()?.unix_timestamp,
    });
    Ok(())
}

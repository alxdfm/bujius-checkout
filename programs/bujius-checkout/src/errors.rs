use anchor_lang::prelude::*;

#[error_code]
pub enum BujiusError {
    #[msg("A split config needs between 1 and 4 recipients")]
    InvalidRecipientCount,
    #[msg("Every recipient needs at least 1 bps")]
    ZeroBps,
    #[msg("The recipients' bps add up to more than 10 000")]
    SplitOverflow,
    #[msg("Recipient wallets must be distinct and different from the merchant")]
    DuplicateRecipient,
    #[msg("The amount must be greater than zero")]
    ZeroAmount,
    #[msg("The mint does not match the split config's mint")]
    MintMismatch,
    #[msg("A token account is not the expected associated token account")]
    BadTokenAccount,
    #[msg("The number of remaining accounts does not match the recipients")]
    RecipientCountMismatch,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}

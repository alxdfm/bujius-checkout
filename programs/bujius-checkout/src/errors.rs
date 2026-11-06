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
}

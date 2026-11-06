# Cards — the contract

> One file per track: [`track-a.md`](track-a.md) (Alexandre) and [`track-b.md`](track-b.md) (the
> partner). Each card is written so it can be executed **without taking an architecture or
> design decision**: every open choice was made in advance, in the card or in
> [`../../CONTRACTS.md`](../../CONTRACTS.md).

## The seven parts

| Part | Meaning |
|---|---|
| **Depends** | The card that must be done first. Do not start a card whose dependency is open. |
| **Why** | One sentence, so you do not re-derive the reason. Not an invitation to redesign. |
| **Already decided** | Design and architecture calls made in advance. **Each bullet is a constraint, not a suggestion.** |
| **Touch only these files** | The complete list. A file not on it is not edited by this card. If the work seems to need one, stop and say so. |
| **Steps** | Numbered and ordered. Each step is one edit or one command. |
| **Never** | The ways this card goes wrong. Read it before the steps. |
| **Done when** | A command and the output it must produce. Nothing is done because it looks done. |

The line under the title carries the size (S/M), the owner, the branch and the time slot
(Brasília).

## Executing a card

1. Read the whole card, **Never** included.
2. Read every file in **Touch only these files**.
3. `git branch --show-current`; create the card's branch from an up-to-date `main`.
4. Do the steps in order. One commit per meaningful step — commit often, never squash.
5. Run the **Done when** command; paste its result in the PR.
6. `pnpm verify` and the pre-push check; rebase on `main`; open the PR; merge when CI is green.
7. Something wrong noticed on the way, outside the card: write it down in
   `docs/sessions/STATE.md` → *Noticed*, do not fix it inside this card.

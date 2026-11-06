## Decision: Bujius Checkout — the open split SDK for Bujius Pay

**Date:** 2026-11-06  
**Status:** accepted  
**Author:** Alexandre

---

## Context

The plan kept a neutral working name (`atomic-split`) until MLH answered whether a project related
to an existing product could carry its brand. On 2026-11-06, at the start of hacking, Alexandre
decided to name the project after the product it serves.

---

## Options considered

| Option | Pros | Cons |
|-------|------|---------|
| Neutral name (`atomic-split`), no mention of Bujius Pay | no question about pre-existing work | hides the real purpose; renaming later costs the npm scope and the program name |
| **Bujius Checkout, explicitly the SDK for Bujius Pay** | honest about what it is for; the npm scope and program name are final from day one | a judge may read it as part of an existing product — the code and its history must show it was written at the event |

---

## Decision

> **Bujius Checkout — explicitly the open split program and SDK for Bujius Pay**

The relationship goes one way: Bujius Pay depends on Bujius Checkout after the event; this
repository never depends on Bujius Pay and never contains its code, its keys or its
infrastructure. Every line here is written during the event.

Names: repository `bujius-checkout` · program `bujius_checkout` · packages
`@bujius/checkout-sdk` and `@bujius/checkout-react` · types `BujiusCheckout…` · webhook header
`BujiusCheckout-Signature`.

---

## Consequences

**Positive:**
- The purpose is explicit; no rename after the event.

**Negative / trade-offs:**
- The rules questions sent to MLH on 2026-11-05 were still unanswered when this was decided. If
  MLH rules against the brand, the rename is a search-and-replace on the names above plus the npm
  scope.

**Impact on the code:**
- Every name above; `PLAN.md` §1–§2.

---

## Future review

When MLH answers the rules questions.

# Decision: zod for the hosted API's request bodies

**Date:** 2026-11-07
**Status:** accepted
**Author:** Alexandre

---

## Context

`POST /v1/charges` is strict: a wallet, recipients, a config or a mint in the body is a `400`
(`CLAUDE.md`, contracts §6). `PLAN.md` §5 lists Drizzle, drizzle-kit and `postgres` for
`apps/hosted`, but no validation library, and card `A8` calls for strict zod bodies.

## Options considered

| Option | Pros | Cons |
|-------|------|---------|
| Hand-written checks | No dependency | Easy to miss a field; the strict rule is the product's central guard |
| `zod` with `.strict()` | One schema states the allowed fields; an extra field fails by construction; `https:` rules for `successUrl` and `webhookUrl` fit in the same place | One more dependency, in `apps/hosted` only |

## Decision

> **`zod` in `apps/hosted` only.**

`.strict()` makes "any other field is a 400" a property of the schema, not of code someone has to
remember. It is not added to the SDK or the program.

## Consequences

- `apps/hosted/package.json` gains `zod`; `PLAN.md` §5 is not edited, this record is the trace.
- Every body of the hosted API is parsed by a strict schema before it reaches the database.

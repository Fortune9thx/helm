# Writing reliable Helm policies

A Helm policy is two plain-language fields: `policy_text` and `action_mapping`. This guide explains
how they're actually used by `evaluate_policy`, so you can write policies that evaluate reliably
instead of ambiguously.

## 1. Name your data source explicitly — Helm does not guess

`evaluate_policy` extracts explicit `https://` URLs from `policy_text` and `action_mapping` with a
plain regex, and fetches only those (up to 3, first-found order). There is no separate "data source"
field on the contract and no implicit web search — if no URL appears in either field, Helm
deterministically records `NO_ACTION` without ever calling an LLM.

**Bad** (no URL — will always resolve to `NO_ACTION`):
> "If the vault's collateral looks unsafe, pause it."

**Good**:
> "If the collateral ratio reported at https://api.example.com/vault/status drops below 150%, pause
> the vault."

**For any policy whose decision carries real consequences (pausing a protocol, moving funds
downstream, adjusting a live parameter), cite 2–3 independent sources rather than one.** Helm supports
up to 3 URLs per policy (extracted from `policy_text` + `action_mapping` combined) and shows all of
them to the model as combined evidence in a single evaluation — a single source being wrong, stale, or
temporarily compromised is a real risk for a high-stakes trigger, and independent corroboration is
cheap to add. Helm does not hard-enforce a minimum source count, since some policies legitimately have
exactly one authoritative source (an official registry, a protocol's own canonical status endpoint)
and forcing a second source in those cases would just add noise — this is a judgment call left to the
policy author, not the contract.

**Good (single authoritative source, appropriate for this policy):**
> "If https://registry.example.gov/status shows the entity as suspended, issue an ALERT."

**Good (multi-source, appropriate for a higher-stakes trigger):**
> "If both https://api.example.com/price and https://api.example-mirror.com/price show a price more
> than 15% below the 24h reference, PAUSE the vault."

## 2. State the condition as a single, checkable threshold

The model evaluates strictly against what the fetched data shows *right now* — it has no memory of
past evaluations and no access to on-chain state beyond what you put in the policy text. Write the
condition the way you'd write it for a competent analyst who only gets to see the page you point them
at, once.

**Bad** (vague, no clear threshold):
> "Watch the price and act if things get bad."

**Good**:
> "If the price reported at https://api.example.com/price is more than 15% below the price reported
> 24 hours ago on the same page, issue an ALERT."

## 3. Pick the decision that matches your intent

Helm's decision enum is closed and each value has a specific meaning your policy text should point
toward clearly:

| Decision | Use when the policy means... |
|---|---|
| `PAUSE` | ...halt protocol operation entirely. |
| `REBALANCE` | ...trigger a rebalancing action across positions/reserves. |
| `SWITCH_ORACLE` | ...the configured oracle/data source itself should change. |
| `ADJUST_PARAM` | ...a numeric or operational parameter should be adjusted. |
| `ALERT` | ...a human should be notified, with no automatic state change. |
| `NO_ACTION` | ...the default: nothing is currently wrong. |

You don't literally have to name the decision in your policy text — the model infers the right one
from context — but writing toward one clearly (rather than a vague "do something") produces more
consistent results across evaluations.

## 4. For `ADJUST_PARAM`/`REBALANCE`/`SWITCH_ORACLE`, ask for one precise number or name

These three decisions are the ones a downstream keeper is expected to *execute* — the value in
`recommended_action_payload` isn't advisory commentary, it's the parameter that gets applied. Because
of that, validators are required to agree on the payload itself, not just the decision label (see
[`SECURITY.md`](./SECURITY.md) §6). Two independent model runs will naturally reach the exact same
*number* far more reliably than the exact same *paragraph* — so phrase the condition so the answer is
one clean value, not an open-ended judgment call.

**Bad** (invites a differently-worded payload every run, e.g. "reduce slightly" vs. "lower by 10%"):
> "If liquidity looks thin, adjust the fee parameter to something more conservative."

**Good** (the payload has exactly one correct value to converge on):
> "If the utilization rate at https://api.example.com/pool/status exceeds 90%, ADJUST_PARAM to set
> the borrow_fee_bps to 250."

`PAUSE`/`ALERT`/`NO_ACTION` don't have this constraint — their payload is context only, so it's fine
to leave it looser for those three.

## 5. Use `action_mapping` for downstream intent, not for Helm itself

`action_mapping` is shown to the model as context (it helps the model understand *why* a decision
matters), but **Helm itself never calls another contract**. Cross-contract writes are confirmed to
silently no-op on the current Bradbury GenVM build, so Helm's architecture is pull-based: a downstream
keeper or contract reads `get_latest_evaluation` and interprets `action_mapping` itself.

Write `action_mapping` as a short, literal description a keeper script or another contract's operator
can parse or read directly:

> "PAUSE -> call vault.pause(); NO_ACTION -> do nothing."

## 6. Keep it short — the caps are enforced, not suggestions

`policy_text` is capped at 1200 characters and `action_mapping` at 800, enforced in the contract
itself (input beyond the cap is silently truncated, not rejected). Say the condition once, precisely,
rather than padding it with repeated caveats.

## 7. Expect `NO_ACTION` far more often than not — that's correct

Helm fails closed by design (see [`SECURITY.md`](./SECURITY.md) §4): insufficient evidence, an
ambiguous condition, or confidence below 0.78 all resolve to `NO_ACTION`. If you're seeing `NO_ACTION`
when you expected otherwise, check first whether:

- The URL in your policy is still live and actually shows the condition you're describing.
- The condition is stated as something checkable from that page's content alone.
- The threshold is a real, specific number/fact rather than a subjective judgment call the model has
  no basis to make confidently.

## 8. Re-evaluate, don't over-trust a single reading

Live data changes. `evaluate_policy` re-fetches fresh data on every call — nothing is cached from a
prior evaluation. If your use case needs continuous monitoring, trigger `evaluate_policy` on whatever
cadence matches how fast the underlying condition can change (a keeper, a scheduled job, or manual
triggers from the dashboard all work — anyone may call it).

## Example: a complete, reliable policy

**Name:** `Stablecoin Peg Guard`

**Policy text:**
> "If the price reported at https://api.example.com/stablecoin/price deviates more than 3% from
> $1.00 in either direction, issue an ALERT."

**Action mapping:**
> "ALERT -> notify the treasury multisig via the ops dashboard; NO_ACTION -> do nothing."

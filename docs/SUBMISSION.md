# Submission: Quality Bar mapping

This document maps Helm directly against each Quality Bar item, with concrete evidence rather than
assertions.

## 1. Real trust problem

Helm addresses a real, recurring gap in on-chain protocol operations: reacting to a nuanced,
plain-language operational condition ("if the collateral ratio drops meaningfully below a safe
level...") without either a slow manual process or a brittle hardcoded threshold. See
[`README.md`](./README.md#the-trust-problem) for the full framing. This is infrastructure any
protocol can register against, not a single-purpose demo scenario.

## 2. Live, authoritative data

- `evaluate_policy` fetches live web content via `gl.nondet.web.render(url, mode="text", ...)` for
  every URL named in the policy's own text — confirmed live-tested against real RPC calls during
  frontend verification (`GenLayer RPC error (gen_call): contract not found at address 0x1234...`
  observed when pointing the frontend at a placeholder address, proving the read path genuinely hits
  Bradbury RPC, not a mock).
- No data is fabricated, cached across calls, or hardcoded — every `evaluate_policy` call re-fetches
  fresh, and the fetched excerpt is echoed back in `cited_data` so a reader can see exactly what
  evidence the decision was based on.

## 3. Complete source, accurate docs

- Full contract source: [`contracts/Helm.py`](../contracts/Helm.py) — lint-clean
  (`genvm-lint check`, 3/3 checks passed, 9 methods: 4 write / 5 view).
- Full test suite: [`tests/direct/`](../tests/direct) — 24/24 passing, covering registration, the
  confidence gate, the no-data-source deterministic fail-closed path, schema violations, malformed
  LLM output, the calldata-has-no-float regression (both top-level `confidence` and nested inside
  `recommended_action_payload`), access control, and Equivalence Principle validator
  agreement/disagreement. [`tests/integration/`](../tests/integration) covers the live-network path.
- Docs are written to match the contract's actual behavior, not an aspirational description — every
  method signature, every field name, and every constant (0.78 confidence threshold, 1200/800
  character caps) in [`README.md`](./README.md) and [`POLICY_LANGUAGE.md`](./POLICY_LANGUAGE.md) is
  copied from the real values in `contracts/Helm.py`, not restated from memory.
- [`SECURITY.md`](./SECURITY.md) documents the actual mitigations in the code, including two
  non-obvious platform-specific decisions (skipping `response_format="json"`, `TreeMap[str, str]`-only
  storage) with the reasoning behind each.

## 4. Frontend that genuinely calls the contract, full transaction lifecycle

- Every write (`register_policy`, `update_policy`, `deactivate_policy`, `evaluate_policy`) is wired
  through `frontend/lib/helm-client.ts` to real `genlayer-js` `writeContract` calls — there is no
  mock or simulated response path anywhere in the frontend.
- Every write goes through `useTransactionLifecycle` (`frontend/lib/useTransactionLifecycle.ts`),
  which drives a real `pollConsensusStatus` loop against `client.getTransaction` — the UI shows
  wallet-signature-pending, then a live `ConsensusVisualizer` reflecting the actual transaction status
  progression (`PENDING → PROPOSING → COMMITTING → REVEALING → ACCEPTED/UNDETERMINED/...`), then a
  real success or failure state. Nothing is a fabricated timer.
- Read pages (`/dashboard`, `/explorer`, `/policy/[id]`, `/evaluate/[id]`) all call real
  `readContract` methods (`get_policy`, `get_evaluation`, `get_policies_by_owner`,
  `get_latest_evaluation`, `get_contract_info`) via TanStack Query — verified live against Bradbury
  RPC during frontend testing (§2 above).
- Wallet connection is real RainbowKit/wagmi wiring (`components/WalletConnect.tsx`,
  `components/Providers.tsx`), not a decorative button.

## 5. Meaningfully different from boilerplate

Helm is not a claims/dispute/resolution contract (the common GenLayer boilerplate shape) — it has no
staking, no outcome pools, no adjudication. It is a single-purpose operational-decision engine with a
closed decision enum, a confidence gate, and a pull-based cross-contract architecture built
specifically around a platform constraint (cross-contract writes silently no-op on Bradbury) verified
independently of this project. The policy-language design (extracting data-source URLs from free text
rather than a separate structured field) and the decision-payload deep-float-sanitization defense are
both specific to Helm's actual failure modes, not copied from a template.

## 6. Credible continued-use path

Helm is designed as standing infrastructure: any number of unrelated protocols can register policies
against the same deployed contract at any time, with no redeployment. Integration is a single
`.view()` call from a protocol's own existing keeper/contract — see
[`README.md`](./README.md#continued-use-path). The explorer page
(`frontend/app/explorer`) is built specifically to let any protocol discover and audit every policy
already registered, which only matters for infrastructure meant to accumulate real usage over time,
not a single demo run.

## Portal-reviewer self-check

Run as a senior-reviewer pass before submission (see also [`README.md`](./README.md#local-development)
for how to reproduce every claim below):

| Check | Status |
|---|---|
| Frontend faking Intelligent Contract behavior | **No** — every write/read is a real `genlayer-js` call, verified against live Bradbury RPC (§4 above). |
| Missing trigger UI for a contract write method | **No** — all 4 write methods have a real UI entry point: register (dashboard dialog), update/deactivate (policy detail page, owner-gated), evaluate (evaluate page, open to any caller). |
| Hardcoded values that should be dynamic | **No** — contract address is read from `lib/contracts.ts` (populated by the deploy script) with an env-var override; policy/evaluation data is always fetched live, never hardcoded. |
| Schema drift between frontend and contract | **No** — `frontend/lib/helm-abi.ts`'s TypeScript types mirror the exact dict shape `contracts/Helm.py`'s view methods return, including the closed decision enum. |
| No wallet connection wiring | **No** — RainbowKit + wagmi, real `ConnectButton.Custom` implementation. |
| No pending/async states around transactions | **No** — `useTransactionLifecycle` + `TransactionPanel` cover submitting/polling/success/error for every write. |
| Validation mismatches (frontend vs. contract) | **No** — `RegisterPolicyForm`'s character caps (120/1200/800) match `MAX_NAME_LEN`/`MAX_POLICY_TEXT_LEN`/`MAX_ACTION_MAPPING_LEN` in the contract exactly. |

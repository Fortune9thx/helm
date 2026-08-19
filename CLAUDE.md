# Helm — CLAUDE.md

Helm is a GenLayer **Intelligent Contract** project: *Intelligent Operational Control Layer for On-Chain Protocols*. Protocols register natural-language operational policies; on trigger, the contract fetches live data, evaluates the policy under GenLayer's Equivalence Principle, and emits a structured, consensus-backed operational decision (`PAUSE` / `REBALANCE` / `SWITCH_ORACLE` / `ADJUST_PARAM` / `NO_ACTION` / `ALERT`).

Target network: **GenLayer Bradbury testnet** (chainId `4221`, RPC `https://rpc-bradbury.genlayer.com`, explorer `https://explorer-bradbury.genlayer.com`).

## Ground rules for any agent working in this repo

1. **Always run `genvm-lint check contracts/Helm.py` after any contract change**, and fix every issue before considering the change done. Passing live tests is *not* sufficient evidence of lint-cleanliness — genvm-lint enforces static rules (e.g. exactly one top-level non-deterministic call per method, named `def` leaders only, never `lambda`) that the runtime does not currently enforce at execution time.
2. **Always prefer direct-mode tests first** (`tests/direct/`, via `gltest`) before touching the integration/Studio/Bradbury path. Direct mode is fast, free, and catches most logic bugs; only fall back to live network testing to confirm platform behavior direct mode can't simulate.
3. **Follow the official genlayer-dev skill / docs patterns** — https://docs.genlayer.com. When a pattern here diverges from generic Python/Solidity intuition, trust the GenLayer-specific docs and this file over instinct.
4. **Security is non-negotiable** — see `docs/SECURITY.md`. Every change touching prompt construction, user input handling, or output parsing must be checked against it before merging.

## Verified platform constraints (Bradbury, current build)

These are hard-won, live-verified facts about the current Bradbury GenVM build. Do not "fix" code that follows these rules based on generic best-practice advice — verify any contradicting suggestion against primary sources before changing proven patterns.

- **Storage:** only `TreeMap[str, str]` is confirmed reliable. `TreeMap` with any other value type (`u256`, `bool`, a `@dataclass`, etc.) deploys and reaches ACCEPTED consensus normally, but the contract becomes **permanently unreadable** afterward — no explicit error, just silent failure on every subsequent read. All structured records (policies, evaluations) are stored as JSON strings inside `TreeMap[str, str]`. Non-TreeMap top-level attributes (`Address`, `u256`, `bool`, `str`) are fine.
- **No float in calldata:** GenVM calldata encoding has no float type. Any bare JSON number with a decimal (e.g. `"confidence": 0.85`) returned by `gl.nondet.exec_prompt(..., response_format="json")` becomes a Python `float` and crashes at the calldata boundary — and the same is true of any contract method's own return value containing a raw float (e.g. a computed average), not just LLM output. **Rule: the LLM prompt must require `confidence` as a quoted JSON string; parse it with `float()` for internal logic, then always re-stringify before storing or returning.**
- **One non-deterministic call per method:** `genvm-lint` requires exactly one top-level `gl.eq_principle.*` / `gl.vm.run_nondet_unsafe` call per write method, and the leader function must be a named `def`, never an inline `lambda`. Fold any web-fetching *inside* that single leader function rather than calling it before/alongside the eq_principle call.
- **`prompt_non_comparative` requires the leader to return `str`**, not a dict — even though `exec_prompt(response_format="json")` auto-parses its own response into a dict. `json.dumps(...)` it back to a string before returning from the leader function.
- **Cross-contract calls:** reads via `.view()` work reliably; writes via `.emit(on=...)` reach ACCEPTED consensus but silently no-op — the target contract's state never actually changes. Helm therefore never performs inline cross-contract writes. Instead it stores its own decision on-chain (`get_latest_evaluation`), and any downstream contract/keeper pulls that decision via `.view()` and acts on it in its own transaction. This is a deliberate, verified architectural choice — do not "simplify" it into a direct write call.
- **Errors:** use `gl.vm.UserError("message")` for user-facing reverts, never bare `raise Exception(...)`.
- **Timestamps:** prefer `gl.message_raw["datetime"]` (an ISO-8601 string) over `datetime.now()` for anything stored or gating consensus-critical branching.

## Toolchain (Windows)

- Python: `C:\Users\HP\AppData\Local\Programs\Python\Python312\python.exe` (not on PATH by default).
- `pip install genlayer-test genvm-linter python-dotenv` — provides `gltest` (direct-mode pytest plugin) and `genvm-lint` (subcommands: `check`, `lint`, `validate`, `typecheck`, `schema`).
- Both auto-download the matching GenVM SDK build on first run, keyed by the contract's `Depends` header hash.
- Run `genvm-lint` with `PYTHONIOENCODING=utf-8` prefixed (its checkmark glyph crashes cp1252 stdout on Windows).
- Node/npm live at `C:\Users\HP\nodejs`, not on PATH by default.

## Deployment / GitHub / Vercel

These are **never** performed autonomously. Always stop and get explicit confirmation from the user immediately before: switching the active wallet/account, switching network, running an actual deploy transaction, creating or pushing to a GitHub repo, or deploying to Vercel — even mid-task, even after a general go-ahead earlier in the conversation.

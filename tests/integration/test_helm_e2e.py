"""
Integration test skeleton against a real GenLayer node (Studio or Bradbury
testnet). This is the only test file in this repo that exercises a real
LLM call and real gl.nondet.web.render() -- gltest's direct-mode WASI mock
covers the deterministic logic paths (see tests/direct/), this file proves
the whole pipeline actually reaches live consensus on-chain.

Requires gltest.config.yaml pointing at a live node and a funded test
account. Run with: gltest tests/integration -v
Skips automatically if no RPC endpoint is reachable, so plain `pytest`
(without the gltest plugin/network config) won't false-fail in an
environment with no network access.
"""

import time
from pathlib import Path

import pytest

CONTRACTS_DIR = Path(__file__).resolve().parents[2] / "contracts"
HELM_PATH = CONTRACTS_DIR / "Helm.py"

pytestmark = pytest.mark.integration

POLICY_NAME = "Wikipedia Arithmetic Sanity Check"
# Uses Wikipedia's REST summary API (/api/rest_v1/page/summary/<title>), not
# the human-facing HTML page (/wiki/<title>). Confirmed directly (2026-09-06):
# the HTML page for "2 + 2" returns 200 to a plain curl request but 404s the
# moment a browser-style User-Agent header is set -- real, reproducible
# evidence of User-Agent-based filtering that made this test genuinely flaky
# (observed LEADER_TIMEOUT/VALIDATORS_TIMEOUT across independent validator
# fetches hitting that same inconsistency). The REST summary endpoint
# returned 200 with or without a browser User-Agent in the same check -- API
# endpoints are built for machine consumption and aren't subject to the same
# bot-detection as the wiki's rendered pages. Its "Addition" summary is a
# stable, unambiguous definitional fact ("Addition... is one of the four
# basic operations of arithmetic... 3 apples + 2 apples = 5 apples"), so the
# expected decision stays a precise, checkable ALERT rather than a vague
# "any valid enum" assertion -- the fix here is the data source, not
# loosening what the steward asked this test to actually verify.
POLICY_TEXT = (
    "Check https://en.wikipedia.org/api/rest_v1/page/summary/Addition -- if "
    "the page confirms that addition is a basic arithmetic operation used "
    "to combine two numbers into a sum, issue an ALERT noting the "
    "confirmation; otherwise NO_ACTION."
)
ACTION_MAPPING = "ALERT -> notify operator; NO_ACTION -> do nothing."


@pytest.fixture(scope="module")
def helm(get_contract_factory, accounts):
    deployer = accounts[0]
    contract_factory = get_contract_factory(contract_file_path=str(HELM_PATH))
    return contract_factory.connect(deployer).deploy()


def test_register_policy_persists_on_chain(helm, accounts):
    caller = accounts[0]
    policy_id = helm.connect(caller).register_policy(POLICY_NAME, POLICY_TEXT, ACTION_MAPPING)
    assert isinstance(policy_id, str) and policy_id

    record = helm.get_policy(policy_id)
    assert record["name"] == POLICY_NAME
    assert record["active"] is True


def test_evaluate_policy_reaches_consensus_on_chain(helm, accounts):
    caller = accounts[0]
    policy_id = helm.connect(caller).register_policy(
        POLICY_NAME, POLICY_TEXT, ACTION_MAPPING
    )

    eval_id = helm.connect(caller).evaluate_policy(policy_id)
    assert isinstance(eval_id, str) and eval_id

    # Live consensus can take a few seconds to finalize; poll briefly rather
    # than assuming an immediate read reflects the just-accepted state.
    evaluation = None
    for _ in range(10):
        evaluation = helm.get_evaluation(eval_id)
        if evaluation.get("decision"):
            break
        time.sleep(3)

    assert evaluation is not None
    # Known policy/source: the Addition summary reliably confirms the fact,
    # so the expected decision is ALERT (the policy maps the confirmation to
    # ALERT and everything else to NO_ACTION).
    assert evaluation["decision"] == "ALERT"
    assert isinstance(evaluation["confidence"], str)
    float(evaluation["confidence"])  # must parse cleanly as a decimal string

    info = helm.get_contract_info()
    assert policy_id in info["all_policy_ids"]

"""
Direct-mode tests for evaluate_policy() -- the Intelligent Contract heart.

Covers: high-confidence decision application, the 0.78 confidence gate
forcing NO_ACTION, deterministic fail-closed behavior when no data source
URL is present, malformed/schema-violating LLM output failing closed, the
calldata-has-no-float regression (bare float confidence AND a bare float
inside recommended_action_payload), and Equivalence Principle validator
agreement/disagreement.
"""

import json

from gltest.direct import VMContext, deploy_contract, create_test_addresses

from conftest import HELM_PATH

NAME = "Vault Solvency Guard"
POLICY_TEXT = "If the collateral ratio reported at https://api.example.com/vault-status drops below 150%, pause the vault."
ACTION_MAPPING = "PAUSE -> call vault.pause(); NO_ACTION -> do nothing."
NO_URL_TEXT = "If the vault's internal solvency looks bad, pause it."
NO_URL_MAPPING = "PAUSE -> call vault.pause()."


def _deploy_with_policy(vm, owner, text=POLICY_TEXT, mapping=ACTION_MAPPING):
    vm.sender = owner
    helm = deploy_contract(HELM_PATH, vm)
    policy_id = helm.register_policy(NAME, text, mapping)
    return helm, policy_id


def _web(body: str) -> dict:
    return {"method": "GET", "status": 200, "body": body}


def _wrapped_json(payload: dict) -> str:
    """LLM responses are rarely bare JSON in practice -- wrap it in prose the
    way a real model would, forcing the contract's own brace-stripping
    parser to do real work rather than relying on a mock's auto-parse."""
    return f"Here is my analysis.\n```json\n{json.dumps(payload)}\n```\nEnd of response."


def test_evaluate_high_confidence_applies_decision():
    vm = VMContext()
    owner, = create_test_addresses(1)
    with vm.activate():
        helm, policy_id = _deploy_with_policy(vm, owner)
        vm.mock_web(r"example\.com/vault-status", _web("Collateral ratio is currently 121%, below the 150% threshold."))
        vm.mock_llm(
            r"Equivalence\s+Principle",
            _wrapped_json(
                {
                    "decision": "PAUSE",
                    "confidence": "0.93",
                    "reasoning": "Collateral ratio 121% is below the 150% threshold.",
                    "cited_data": ["Collateral ratio is currently 121%"],
                    "recommended_action_payload": {"reason_code": "collateral_below_threshold"},
                }
            ),
        )
        eval_id = helm.evaluate_policy(policy_id)

        evaluation = helm.get_evaluation(eval_id)
        assert evaluation["decision"] == "PAUSE"
        assert evaluation["confidence"] == "0.93"
        assert evaluation["recommended_action_payload"] == {"reason_code": "collateral_below_threshold"}

        latest = helm.get_latest_evaluation(policy_id)
        assert latest["evaluation_id"] == eval_id

        policy = helm.get_policy(policy_id)
        assert policy["eval_count"] == "1"
        assert policy["latest_eval_id"] == eval_id


def test_evaluate_low_confidence_forces_no_action():
    vm = VMContext()
    owner, = create_test_addresses(1)
    with vm.activate():
        helm, policy_id = _deploy_with_policy(vm, owner)
        vm.mock_web(r"example\.com/vault-status", _web("Collateral ratio looks marginal."))
        vm.mock_llm(
            r"Equivalence\s+Principle",
            _wrapped_json(
                {
                    "decision": "PAUSE",
                    "confidence": "0.40",  # below CONFIDENCE_THRESHOLD (0.78)
                    "reasoning": "Data is ambiguous but leans toward pausing.",
                    "cited_data": ["Collateral ratio looks marginal."],
                    "recommended_action_payload": {},
                }
            ),
        )
        eval_id = helm.evaluate_policy(policy_id)
        evaluation = helm.get_evaluation(eval_id)

        assert evaluation["decision"] == "NO_ACTION"
        assert evaluation["confidence"] == "0.4"


def test_evaluate_without_data_source_url_is_deterministic_no_action():
    """No URL anywhere in policy_text/action_mapping -> Helm must fail
    closed WITHOUT ever invoking the LLM (no mock_llm registered at all;
    the test would fail with an unmocked-prompt error if the contract tried
    to call exec_prompt here)."""
    vm = VMContext()
    owner, = create_test_addresses(1)
    with vm.activate():
        helm, policy_id = _deploy_with_policy(vm, owner, text=NO_URL_TEXT, mapping=NO_URL_MAPPING)
        eval_id = helm.evaluate_policy(policy_id)
        evaluation = helm.get_evaluation(eval_id)

        assert evaluation["decision"] == "NO_ACTION"
        assert evaluation["confidence"] == "0.0"
        assert evaluation["data_sources_used"] == []


def test_evaluate_strips_trailing_punctuation_from_urls():
    """Natural prose routinely follows a URL directly with a comma or
    period ('...at https://api.example.com/status, drops below...').
    Regression test for a real functional bug: without stripping, the
    fetched URL is silently wrong (trailing comma included), which used to
    surface only as an unexplained NO_ACTION with no indication why."""
    vm = VMContext()
    owner, = create_test_addresses(1)
    with vm.activate():
        text_with_trailing_punctuation = (
            "If the ratio at https://api.example.com/vault-status, drops below 150%, pause the vault."
        )
        helm, policy_id = _deploy_with_policy(
            vm, owner, text=text_with_trailing_punctuation, mapping=ACTION_MAPPING
        )
        vm.mock_web(r"example\.com/vault-status$", _web("Collateral ratio is 121%."))
        vm.mock_llm(
            r"Equivalence\s+Principle",
            _wrapped_json(
                {
                    "decision": "PAUSE",
                    "confidence": "0.90",
                    "reasoning": "Below threshold.",
                    "cited_data": ["121%"],
                    "recommended_action_payload": {},
                }
            ),
        )
        eval_id = helm.evaluate_policy(policy_id)
        evaluation = helm.get_evaluation(eval_id)

        # The mock_web pattern is anchored with $ (no trailing comma) --
        # this only matches, and the mocked "121%" content only reaches the
        # prompt, if the extracted URL had its trailing comma stripped.
        assert evaluation["data_sources_used"] == ["https://api.example.com/vault-status"]
        assert evaluation["decision"] == "PAUSE"


def test_evaluate_confidence_bare_float_never_crashes():
    """Regression test for the calldata-has-no-float class of bug: even if
    the LLM returns confidence as a bare JSON number (not a quoted string,
    despite the prompt's explicit instruction), the contract must coerce it
    to a string before it ever crosses a calldata boundary."""
    vm = VMContext()
    owner, = create_test_addresses(1)
    with vm.activate():
        helm, policy_id = _deploy_with_policy(vm, owner)
        vm.mock_web(r"example\.com/vault-status", _web("Collateral ratio is 121%."))
        vm.mock_llm(
            r"Equivalence\s+Principle",
            _wrapped_json(
                {
                    "decision": "PAUSE",
                    "confidence": 0.85,  # bare float, not a string -- the failure mode
                    "reasoning": "Below threshold.",
                    "cited_data": ["121%"],
                    "recommended_action_payload": {},
                }
            ),
        )
        eval_id = helm.evaluate_policy(policy_id)
        evaluation = helm.get_evaluation(eval_id)
        assert evaluation["confidence"] == "0.85"
        assert isinstance(evaluation["confidence"], str)


def test_evaluate_payload_bare_float_is_deep_stringified():
    """Regression test: a bare float nested inside recommended_action_payload
    must never survive to storage or a return value either -- not just the
    top-level confidence field."""
    vm = VMContext()
    owner, = create_test_addresses(1)
    with vm.activate():
        helm, policy_id = _deploy_with_policy(vm, owner)
        vm.mock_web(r"example\.com/vault-status", _web("Collateral ratio is 121%."))
        vm.mock_llm(
            r"Equivalence\s+Principle",
            _wrapped_json(
                {
                    "decision": "ADJUST_PARAM",
                    "confidence": "0.88",
                    "reasoning": "Parameter should move.",
                    "cited_data": ["121%"],
                    "recommended_action_payload": {"new_threshold": 1.55},  # bare float
                }
            ),
        )
        eval_id = helm.evaluate_policy(policy_id)
        evaluation = helm.get_evaluation(eval_id)

        payload = evaluation["recommended_action_payload"]
        assert payload["new_threshold"] == "1.55"
        assert isinstance(payload["new_threshold"], str)

        # Round-trips cleanly through get_evaluation a second time too --
        # proves no float re-enters via json.loads on a later read.
        again = helm.get_evaluation(eval_id)
        assert again["recommended_action_payload"]["new_threshold"] == "1.55"


def test_evaluate_schema_violation_fails_closed():
    """LLM hallucinates a decision string outside the closed enum -> must
    fall back to NO_ACTION rather than storing garbage state."""
    vm = VMContext()
    owner, = create_test_addresses(1)
    with vm.activate():
        helm, policy_id = _deploy_with_policy(vm, owner)
        vm.mock_web(r"example\.com/vault-status", _web("Collateral ratio is 121%."))
        vm.mock_llm(
            r"Equivalence\s+Principle",
            _wrapped_json(
                {
                    "decision": "DESTROY_EVERYTHING",
                    "confidence": "0.95",
                    "reasoning": "n/a",
                    "cited_data": [],
                    "recommended_action_payload": {},
                }
            ),
        )
        eval_id = helm.evaluate_policy(policy_id)
        evaluation = helm.get_evaluation(eval_id)
        assert evaluation["decision"] == "NO_ACTION"


def test_evaluate_malformed_response_fails_closed():
    """LLM returns non-JSON prose entirely -> parser yields {}, contract
    must still fail closed to NO_ACTION rather than raising."""
    vm = VMContext()
    owner, = create_test_addresses(1)
    with vm.activate():
        helm, policy_id = _deploy_with_policy(vm, owner)
        vm.mock_web(r"example\.com/vault-status", _web("Collateral ratio is 121%."))
        vm.mock_llm(r"Equivalence\s+Principle", "I refuse to answer in JSON today.")
        eval_id = helm.evaluate_policy(policy_id)
        evaluation = helm.get_evaluation(eval_id)
        assert evaluation["decision"] == "NO_ACTION"
        assert evaluation["confidence"] == "0.0"


def test_evaluate_not_found_reverts():
    vm = VMContext()
    owner, = create_test_addresses(1)
    with vm.activate():
        vm.sender = owner
        helm = deploy_contract(HELM_PATH, vm)
        with vm.expect_revert("not found"):
            helm.evaluate_policy("nonexistent-policy-id")


def test_validator_agrees_on_matching_decision_and_close_confidence():
    vm = VMContext()
    owner, = create_test_addresses(1)
    with vm.activate():
        helm, policy_id = _deploy_with_policy(vm, owner)
        vm.mock_web(r"example\.com/vault-status", _web("Collateral ratio is 121%."))
        vm.mock_llm(
            r"Equivalence\s+Principle",
            _wrapped_json(
                {
                    "decision": "PAUSE",
                    "confidence": "0.90",
                    "reasoning": "Below threshold.",
                    "cited_data": ["121%"],
                    "recommended_action_payload": {},
                }
            ),
        )
        helm.evaluate_policy(policy_id)

        agrees = vm.run_validator()
        assert agrees is True


def test_validator_disagrees_on_confidence_outside_tolerance():
    vm = VMContext()
    owner, = create_test_addresses(1)
    with vm.activate():
        helm, policy_id = _deploy_with_policy(vm, owner)
        vm.mock_web(r"example\.com/vault-status", _web("Collateral ratio is 121%."))
        vm.mock_llm(
            r"Equivalence\s+Principle",
            _wrapped_json(
                {
                    "decision": "PAUSE",
                    "confidence": "0.90",
                    "reasoning": "Below threshold.",
                    "cited_data": ["121%"],
                    "recommended_action_payload": {},
                }
            ),
        )
        helm.evaluate_policy(policy_id)

        disagrees = vm.run_validator(
            leader_result={
                "decision": "PAUSE",
                "confidence": "0.20",
                "reasoning": "Barely.",
                "cited_data": ["121%"],
                "recommended_action_payload": {},
            }
        )
        assert disagrees is False


def test_validator_disagrees_on_different_decision():
    vm = VMContext()
    owner, = create_test_addresses(1)
    with vm.activate():
        helm, policy_id = _deploy_with_policy(vm, owner)
        vm.mock_web(r"example\.com/vault-status", _web("Collateral ratio is 121%."))
        vm.mock_llm(
            r"Equivalence\s+Principle",
            _wrapped_json(
                {
                    "decision": "PAUSE",
                    "confidence": "0.90",
                    "reasoning": "Below threshold.",
                    "cited_data": ["121%"],
                    "recommended_action_payload": {},
                }
            ),
        )
        helm.evaluate_policy(policy_id)

        disagrees = vm.run_validator(
            leader_result={
                "decision": "NO_ACTION",
                "confidence": "0.90",
                "reasoning": "Fine.",
                "cited_data": ["121%"],
                "recommended_action_payload": {},
            }
        )
        assert disagrees is False

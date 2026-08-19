"""
Direct-mode tests for Helm's read-only view methods.
"""

import json

from gltest.direct import VMContext, deploy_contract, create_test_addresses

from conftest import HELM_PATH, to_hex

NAME = "Vault Solvency Guard"
POLICY_TEXT = "If the collateral ratio reported at https://api.example.com/vault-status drops below 150%, pause the vault."
ACTION_MAPPING = "PAUSE -> call vault.pause(); NO_ACTION -> do nothing."


def _web(body: str) -> dict:
    return {"method": "GET", "status": 200, "body": body}


def _wrapped_json(payload: dict) -> str:
    return f"```json\n{json.dumps(payload)}\n```"


def test_get_policy_not_found_reverts():
    vm = VMContext()
    owner, = create_test_addresses(1)
    with vm.activate():
        vm.sender = owner
        helm = deploy_contract(HELM_PATH, vm)
        with vm.expect_revert("not found"):
            helm.get_policy("nonexistent")


def test_get_evaluation_not_found_reverts():
    vm = VMContext()
    owner, = create_test_addresses(1)
    with vm.activate():
        vm.sender = owner
        helm = deploy_contract(HELM_PATH, vm)
        with vm.expect_revert("not found"):
            helm.get_evaluation("nonexistent:0")


def test_get_latest_evaluation_default_before_first_evaluation():
    vm = VMContext()
    owner, = create_test_addresses(1)
    with vm.activate():
        vm.sender = owner
        helm = deploy_contract(HELM_PATH, vm)
        policy_id = helm.register_policy(NAME, POLICY_TEXT, ACTION_MAPPING)

        latest = helm.get_latest_evaluation(policy_id)
        assert latest["evaluation_id"] == ""
        assert latest["decision"] == ""
        assert latest["confidence"] == "0.0"
        assert latest["reasoning"] == "No evaluation yet."


def test_get_latest_evaluation_after_evaluation():
    vm = VMContext()
    owner, = create_test_addresses(1)
    with vm.activate():
        vm.sender = owner
        helm = deploy_contract(HELM_PATH, vm)
        policy_id = helm.register_policy(NAME, POLICY_TEXT, ACTION_MAPPING)

        vm.mock_web(r"example\.com/vault-status", _web("Collateral ratio is 121%."))
        vm.mock_llm(
            r"Equivalence\s+Principle",
            _wrapped_json(
                {
                    "decision": "PAUSE",
                    "confidence": "0.91",
                    "reasoning": "Below threshold.",
                    "cited_data": ["121%"],
                    "recommended_action_payload": {},
                }
            ),
        )
        eval_id = helm.evaluate_policy(policy_id)

        latest = helm.get_latest_evaluation(policy_id)
        assert latest["evaluation_id"] == eval_id
        assert latest["decision"] == "PAUSE"


def test_get_contract_info_shape():
    vm = VMContext()
    owner, = create_test_addresses(1)
    with vm.activate():
        vm.sender = owner
        helm = deploy_contract(HELM_PATH, vm)
        helm.register_policy(NAME, POLICY_TEXT, ACTION_MAPPING)

        info = helm.get_contract_info()
        assert info["name"] == "Helm"
        assert info["network"] == "genlayer-bradbury-testnet"
        assert info["chain_id"] == "4221"
        assert info["owner"] == to_hex(owner)
        assert info["policy_count"] == "1"
        assert info["confidence_threshold"] == "0.78"
        assert set(info["decision_enum"]) == {
            "PAUSE", "REBALANCE", "SWITCH_ORACLE", "ADJUST_PARAM", "NO_ACTION", "ALERT",
        }
        assert isinstance(info["all_policy_ids"], list)
        assert len(info["all_policy_ids"]) == 1

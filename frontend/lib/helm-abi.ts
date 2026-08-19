import { HELM_CONTRACT_ADDRESSES, HELM_ACTIVE_NETWORK } from "./contracts";

export const HELM_METHODS = {
  registerPolicy: "register_policy",
  updatePolicy: "update_policy",
  deactivatePolicy: "deactivate_policy",
  evaluatePolicy: "evaluate_policy",
  getPolicy: "get_policy",
  getEvaluation: "get_evaluation",
  getPoliciesByOwner: "get_policies_by_owner",
  getLatestEvaluation: "get_latest_evaluation",
  getContractInfo: "get_contract_info",
} as const;

export const HELM_DECISIONS = [
  "PAUSE",
  "REBALANCE",
  "SWITCH_ORACLE",
  "ADJUST_PARAM",
  "NO_ACTION",
  "ALERT",
] as const;
export type HelmDecision = (typeof HELM_DECISIONS)[number];

export interface PolicyRecord {
  policy_id: string;
  name: string;
  owner: string;
  policy_text: string;
  action_mapping: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  eval_count: string;
  latest_eval_id: string;
}

export interface EvaluationRecord {
  evaluation_id: string;
  policy_id: string;
  eval_index: string;
  decision: HelmDecision | "";
  confidence: string;
  reasoning: string;
  cited_data: string[];
  recommended_action_payload: Record<string, string>;
  data_sources_used: string[];
  evaluated_at: string;
}

export interface HelmContractInfo {
  name: string;
  tagline: string;
  version: string;
  network: string;
  chain_id: string;
  owner: string;
  policy_count: string;
  confidence_threshold: string;
  decision_enum: string[];
  all_policy_ids: string[];
  deployed_at: string;
}

/**
 * Resolution order: an explicit env override (useful for pointing a local
 * dev build at a different deploy without editing contracts.ts) first,
 * then the address deploy/001_deploy_helm.ts wrote into contracts.ts.
 */
export function getHelmAddress(): `0x${string}` {
  const override = process.env.NEXT_PUBLIC_HELM_CONTRACT_ADDRESS;
  const address = (override || HELM_CONTRACT_ADDRESSES[HELM_ACTIVE_NETWORK]) as
    | `0x${string}`
    | undefined;
  if (!address) {
    throw new Error(
      "No Helm contract address configured yet -- run deploy/001_deploy_helm.ts, or set " +
        "NEXT_PUBLIC_HELM_CONTRACT_ADDRESS for local testing."
    );
  }
  return address;
}

export function isHelmDeployed(): boolean {
  const override = process.env.NEXT_PUBLIC_HELM_CONTRACT_ADDRESS;
  return Boolean(override || HELM_CONTRACT_ADDRESSES[HELM_ACTIVE_NETWORK]);
}

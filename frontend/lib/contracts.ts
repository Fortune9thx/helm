/**
 * Deployed Helm contract addresses, keyed by network. Populated by
 * deploy/001_deploy_helm.ts after a real deployment -- undefined until then.
 */
export type HelmNetworkKey = "bradbury" | "studio" | "asimov";

export const HELM_CONTRACT_ADDRESSES: Record<HelmNetworkKey, `0x${string}` | undefined> = {
  bradbury: "0x27BF892Cd9A5B16BBf8CCad66c7a84E2B64558b3",
  studio: undefined,
  asimov: undefined,
};

export const HELM_ACTIVE_NETWORK: HelmNetworkKey = "bradbury";

export const HELM_CONTRACT_ADDRESS = HELM_CONTRACT_ADDRESSES[HELM_ACTIVE_NETWORK];

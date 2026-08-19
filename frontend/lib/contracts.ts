/**
 * Deployed Helm contract addresses, keyed by network. Populated by
 * deploy/001_deploy_helm.ts after a real deployment -- undefined until then.
 */
export type HelmNetworkKey = "bradbury" | "studio" | "asimov";

export const HELM_CONTRACT_ADDRESSES: Record<HelmNetworkKey, `0x${string}` | undefined> = {
  bradbury: "0xBeEbD3180f4644cd58525f46E486Ef1f266E9f67",
  studio: undefined,
  asimov: undefined,
};

export const HELM_ACTIVE_NETWORK: HelmNetworkKey = "bradbury";

export const HELM_CONTRACT_ADDRESS = HELM_CONTRACT_ADDRESSES[HELM_ACTIVE_NETWORK];

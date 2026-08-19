/**
 * Deployed Helm contract addresses, keyed by network. Populated by
 * deploy/001_deploy_helm.ts after a real deployment -- undefined until then.
 */
export type HelmNetworkKey = "bradbury" | "studio" | "asimov";

export const HELM_CONTRACT_ADDRESSES: Record<HelmNetworkKey, `0x${string}` | undefined> = {
  bradbury: "0x911B39fF368d872E1E98F084F2794C2018432C39",
  studio: undefined,
  asimov: undefined,
};

export const HELM_ACTIVE_NETWORK: HelmNetworkKey = "bradbury";

export const HELM_CONTRACT_ADDRESS = HELM_CONTRACT_ADDRESSES[HELM_ACTIVE_NETWORK];

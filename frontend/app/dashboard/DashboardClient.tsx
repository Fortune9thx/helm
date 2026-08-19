"use client";

import { useQuery } from "@tanstack/react-query";
import { useHelmClient, fetchPoliciesByOwner, getReadOnlyHelmClient } from "@/lib/helm-client";
import { isHelmDeployed } from "@/lib/helm-abi";
import { RegisterPolicyForm } from "@/components/RegisterPolicyForm";
import { PolicyCard } from "@/components/PolicyCard";
import { EmptyState } from "@/components/EmptyState";
import { WalletConnect } from "@/components/WalletConnect";
import { Loader2 } from "lucide-react";

export function DashboardClient() {
  const { client, address } = useHelmClient();

  const { data: policies, isLoading, refetch } = useQuery({
    queryKey: ["policies-by-owner", address],
    queryFn: () => fetchPoliciesByOwner(client ?? getReadOnlyHelmClient(), address as string),
    enabled: Boolean(address) && isHelmDeployed(),
  });

  if (!isHelmDeployed()) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <EmptyState
          title="Helm is not deployed yet"
          description="No contract address is configured for this network. Run deploy/001_deploy_helm.ts, or set NEXT_PUBLIC_HELM_CONTRACT_ADDRESS for local testing."
        />
      </div>
    );
  }

  if (!address) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-24">
        <EmptyState
          title="Connect your wallet"
          description="Connect a wallet to register operational policies and control the ones you own."
          action={<WalletConnect />}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Your Policies</h1>
          <p className="mt-1 font-mono text-xs text-text-muted">
            {address.slice(0, 6)}…{address.slice(-4)}
          </p>
        </div>
        <RegisterPolicyForm client={client} onRegistered={() => refetch()} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-text-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !policies || policies.length === 0 ? (
        <EmptyState
          title="No policies yet"
          description="Register your first operational policy to give Helm something to evaluate."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {policies.map((policy) => (
            <PolicyCard key={policy.policy_id} policy={policy} />
          ))}
        </div>
      )}
    </div>
  );
}

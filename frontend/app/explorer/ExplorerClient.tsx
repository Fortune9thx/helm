"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { getReadOnlyHelmClient, fetchContractInfo, fetchPolicy } from "@/lib/helm-client";
import { isHelmDeployed } from "@/lib/helm-abi";
import { PolicyCard } from "@/components/PolicyCard";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ExplorerClient() {
  const client = getReadOnlyHelmClient();
  const [query, setQuery] = useState("");

  const infoQuery = useQuery({
    queryKey: ["contract-info"],
    queryFn: () => fetchContractInfo(client),
    enabled: isHelmDeployed(),
  });

  const policiesQuery = useQuery({
    queryKey: ["all-policies", infoQuery.data?.all_policy_ids],
    queryFn: async () => {
      const ids = infoQuery.data?.all_policy_ids ?? [];
      return Promise.all(ids.map((id) => fetchPolicy(client, id)));
    },
    enabled: Boolean(infoQuery.data),
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

  const filtered = (policiesQuery.data ?? []).filter(
    (p) =>
      !query ||
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.policy_text.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-primary">Policy Explorer</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Every operational policy registered on Helm, across every protocol.
        </p>
      </div>

      {infoQuery.data && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Contract" value={infoQuery.data.name} mono={false} />
          <Stat label="Network" value="Bradbury" mono={false} />
          <Stat label="Policies" value={infoQuery.data.policy_count} />
          <Stat label="Confidence gate" value={`≥ ${infoQuery.data.confidence_threshold}`} />
        </div>
      )}

      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <Input
          placeholder="Search policies…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {infoQuery.isLoading || policiesQuery.isLoading ? (
        <div className="flex items-center justify-center py-24 text-text-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No policies found" description="No registered policies match this network or search yet." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((policy) => (
            <PolicyCard key={policy.policy_id} policy={policy} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <Card hover={false} className="p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={mono ? "mt-1 font-mono text-lg text-cyan" : "mt-1 text-lg text-text-primary"}>{value}</p>
    </Card>
  );
}

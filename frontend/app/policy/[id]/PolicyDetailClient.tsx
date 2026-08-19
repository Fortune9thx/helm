"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Pencil, Ban } from "lucide-react";
import {
  useHelmClient,
  getReadOnlyHelmClient,
  fetchPolicy,
  fetchLatestEvaluation,
  updatePolicy,
  deactivatePolicy,
} from "@/lib/helm-client";
import { useTransactionLifecycle } from "@/lib/useTransactionLifecycle";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DecisionBadge } from "@/components/DecisionBadge";
import { TransactionPanel } from "@/components/TransactionPanel";
import { EmptyState } from "@/components/EmptyState";

export function PolicyDetailClient({ policyId }: { policyId: string }) {
  const { client, address } = useHelmClient();
  const queryClient = useQueryClient();
  const readClient = getReadOnlyHelmClient();

  const policyQuery = useQuery({
    queryKey: ["policy", policyId],
    queryFn: () => fetchPolicy(readClient, policyId),
  });

  const evalQuery = useQuery({
    queryKey: ["latest-evaluation", policyId],
    queryFn: () => fetchLatestEvaluation(readClient, policyId),
    enabled: Boolean(policyQuery.data),
  });

  const [editing, setEditing] = useState(false);
  const [newText, setNewText] = useState("");
  const [newMapping, setNewMapping] = useState("");

  const updateLifecycle = useTransactionLifecycle(client);
  const deactivateLifecycle = useTransactionLifecycle(client);

  if (policyQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (policyQuery.isError || !policyQuery.data) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <EmptyState title="Policy not found" description={`No policy exists with id "${policyId}" on this network.`} />
      </div>
    );
  }

  const policy = policyQuery.data;
  const isOwner = Boolean(address) && address?.toLowerCase() === policy.owner.toLowerCase();

  function startEditing() {
    setNewText(policy.policy_text);
    setNewMapping(policy.action_mapping);
    setEditing(true);
    updateLifecycle.reset();
  }

  async function submitUpdate() {
    await updateLifecycle.run(async () => {
      if (!client) throw new Error("Connect a wallet first.");
      return updatePolicy(client, policyId, newText.trim(), newMapping.trim());
    });
    queryClient.invalidateQueries({ queryKey: ["policy", policyId] });
  }

  async function submitDeactivate() {
    await deactivateLifecycle.run(async () => {
      if (!client) throw new Error("Connect a wallet first.");
      return deactivatePolicy(client, policyId);
    });
    queryClient.invalidateQueries({ queryKey: ["policy", policyId] });
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-text-primary">{policy.name}</h1>
            <span
              className={
                policy.active
                  ? "rounded-full border border-cyan/40 bg-cyan-soft px-2.5 py-0.5 text-[11px] font-medium text-cyan"
                  : "rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-text-muted"
              }
            >
              {policy.active ? "Active" : "Deactivated"}
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-text-muted">{policy.policy_id}</p>
        </div>

        {policy.active && (
          <Link href={`/evaluate/${policy.policy_id}`}>
            <Button>Evaluate Now</Button>
          </Link>
        )}
      </div>

      <Card className="mb-6" hover={false}>
        <CardHeader>
          <CardTitle>Latest Evaluation</CardTitle>
        </CardHeader>
        {evalQuery.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        ) : evalQuery.data && evalQuery.data.evaluation_id ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <DecisionBadge decision={evalQuery.data.decision} />
              <span className="font-mono text-xs text-text-muted">
                confidence {evalQuery.data.confidence}
              </span>
            </div>
            <p className="text-sm text-text-secondary">{evalQuery.data.reasoning}</p>
            {evalQuery.data.cited_data.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs text-text-muted">
                {evalQuery.data.cited_data.map((c, i) => (
                  <li key={i} className="truncate">— {c}</li>
                ))}
              </ul>
            )}
            <Link
              href={`/evaluate/${policy.policy_id}?eval=${evalQuery.data.evaluation_id}`}
              className="text-xs text-cyan-dim hover:text-cyan"
            >
              View full evaluation →
            </Link>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">No evaluation yet — trigger one above.</p>
        )}
      </Card>

      <Card hover={false}>
        <CardHeader>
          <CardTitle>Policy Definition</CardTitle>
        </CardHeader>

        {!editing ? (
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">Policy text</p>
              <p className="whitespace-pre-wrap text-sm text-text-primary">{policy.policy_text}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-text-secondary">Action mapping</p>
              <p className="whitespace-pre-wrap text-sm text-text-primary">{policy.action_mapping}</p>
            </div>
            {isOwner && policy.active && (
              <div className="mt-2 flex gap-3">
                <Button variant="secondary" size="sm" onClick={startEditing}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Update
                </Button>
                <Button variant="danger" size="sm" onClick={submitDeactivate}>
                  <Ban className="mr-1.5 h-3.5 w-3.5" /> Deactivate
                </Button>
              </div>
            )}
            {deactivateLifecycle.state.phase !== "idle" && (
              <TransactionPanel state={deactivateLifecycle.state} onReset={deactivateLifecycle.reset} successLabel="Policy deactivated" />
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Textarea rows={4} value={newText} maxLength={1200} onChange={(e) => setNewText(e.target.value)} />
            <Textarea rows={3} value={newMapping} maxLength={800} onChange={(e) => setNewMapping(e.target.value)} />
            {updateLifecycle.state.phase === "idle" ? (
              <div className="flex gap-3">
                <Button onClick={submitUpdate}>Save Changes</Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            ) : (
              <TransactionPanel
                state={updateLifecycle.state}
                onReset={() => {
                  updateLifecycle.reset();
                  setEditing(false);
                }}
                successLabel="Policy updated"
              />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

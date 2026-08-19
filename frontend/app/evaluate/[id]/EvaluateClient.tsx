"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  useHelmClient,
  getReadOnlyHelmClient,
  fetchPolicy,
  fetchEvaluation,
  fetchLatestEvaluation,
  evaluatePolicy,
} from "@/lib/helm-client";
import { useTransactionLifecycle } from "@/lib/useTransactionLifecycle";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DecisionBadge } from "@/components/DecisionBadge";
import { TransactionPanel } from "@/components/TransactionPanel";
import { EmptyState } from "@/components/EmptyState";
import type { EvaluationRecord } from "@/lib/helm-abi";

export function EvaluateClient({ policyId }: { policyId: string }) {
  const { client } = useHelmClient();
  const readClient = getReadOnlyHelmClient();
  const searchParams = useSearchParams();
  const fixedEvalId = searchParams.get("eval");

  const policyQuery = useQuery({
    queryKey: ["policy", policyId],
    queryFn: () => fetchPolicy(readClient, policyId),
  });

  const fixedEvalQuery = useQuery({
    queryKey: ["evaluation", fixedEvalId],
    queryFn: () => fetchEvaluation(readClient, fixedEvalId as string),
    enabled: Boolean(fixedEvalId),
  });

  const [freshResult, setFreshResult] = useState<EvaluationRecord | null>(null);
  const lifecycle = useTransactionLifecycle(client);

  async function trigger() {
    setFreshResult(null);
    // requireFinalized: true -- ACCEPTED can still be appealed and reversed
    // before FINALIZED. evaluate_policy's whole purpose is producing a
    // decision a downstream contract or keeper acts on, so this UI must not
    // claim "recorded on-chain" until the outcome is actually permanent;
    // showing that at ACCEPTED could lead a keeper to act on a decision
    // that later gets reversed on appeal. Every other Helm write
    // (register/update/deactivate) is a read-only fact if reversed --
    // nothing downstream is triggered off them -- so they intentionally
    // stay at the faster ACCEPTED-terminal default.
    await lifecycle.run(
      async () => {
        if (!client) throw new Error("Connect a wallet first.");
        return evaluatePolicy(client, policyId);
      },
      { requireFinalized: true }
    );
  }

  useEffect(() => {
    if (lifecycle.state.phase !== "success" || freshResult) return;
    let cancelled = false;
    fetchLatestEvaluation(readClient, policyId).then((result) => {
      if (!cancelled) setFreshResult(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifecycle.state.phase, freshResult, policyId]);

  if (policyQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!policyQuery.data) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <EmptyState title="Policy not found" description={`No policy exists with id "${policyId}" on this network.`} />
      </div>
    );
  }

  const policy = policyQuery.data;
  const displayEval = fixedEvalId ? fixedEvalQuery.data : freshResult;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href={`/policy/${policyId}`} className="mb-6 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to policy
      </Link>

      <h1 className="text-2xl font-semibold text-text-primary">{policy.name}</h1>
      <p className="mt-1 text-sm text-text-secondary">{policy.policy_text}</p>

      <div className="mt-8">
        {!fixedEvalId && lifecycle.state.phase === "idle" && !freshResult && (
          <Card className="flex flex-col items-center gap-4 py-12 text-center" hover={false}>
            <p className="max-w-md text-sm text-text-secondary">
              Fetches live data from this policy&rsquo;s data source(s), evaluates it under the
              Equivalence Principle, and records a consensus-backed decision on-chain.
            </p>
            <Button size="lg" onClick={trigger} disabled={!policy.active}>
              {policy.active ? "Run Evaluation" : "Policy is deactivated"}
            </Button>
          </Card>
        )}

        {!fixedEvalId && lifecycle.state.phase !== "idle" && !freshResult && (
          <TransactionPanel
            state={lifecycle.state}
            onReset={lifecycle.reset}
            successLabel="Finalized on-chain — decision is now permanent"
          />
        )}

        {displayEval && (
          <Card className="mt-6" hover={false}>
            <CardHeader>
              <CardTitle>Evaluation Result</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <DecisionBadge decision={displayEval.decision} />
                <span className="font-mono text-xs text-text-muted">confidence {displayEval.confidence}</span>
                <span className="font-mono text-xs text-text-muted">·</span>
                <span className="font-mono text-xs text-text-muted">{displayEval.evaluation_id}</span>
              </div>
              <p className="text-sm text-text-primary">{displayEval.reasoning}</p>

              {displayEval.data_sources_used.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-text-secondary">Data sources checked</p>
                  <ul className="flex flex-col gap-1">
                    {displayEval.data_sources_used.map((u, i) => (
                      <li key={i} className="truncate font-mono text-xs text-cyan-dim">{u}</li>
                    ))}
                  </ul>
                </div>
              )}

              {displayEval.cited_data.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-text-secondary">Cited evidence</p>
                  <ul className="flex flex-col gap-1 text-xs text-text-secondary">
                    {displayEval.cited_data.map((c, i) => (
                      <li key={i}>— {c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {Object.keys(displayEval.recommended_action_payload ?? {}).length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-text-secondary">Recommended action payload</p>
                  <pre className="overflow-x-auto rounded-lg bg-void-raised p-3 font-mono text-xs text-text-secondary">
                    {JSON.stringify(displayEval.recommended_action_payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </Card>
        )}

        {!fixedEvalId && freshResult && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFreshResult(null);
                lifecycle.reset();
              }}
            >
              Run Another Evaluation
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

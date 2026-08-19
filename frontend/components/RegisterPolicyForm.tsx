"use client";

import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { TransactionPanel } from "./TransactionPanel";
import { useTransactionLifecycle } from "@/lib/useTransactionLifecycle";
import { registerPolicy } from "@/lib/helm-client";
import type { GenLayerClient, GenLayerChain } from "genlayer-js/types";

const MAX_NAME = 120;
const MAX_POLICY_TEXT = 1200;
const MAX_ACTION_MAPPING = 800;

export function RegisterPolicyForm({
  client,
  onRegistered,
}: {
  client: GenLayerClient<GenLayerChain> | null;
  onRegistered?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [policyText, setPolicyText] = useState("");
  const [actionMapping, setActionMapping] = useState("");
  const { state, run, reset } = useTransactionLifecycle(client);

  // Mirrors the contract's own _extract_urls regex exactly: evaluate_policy
  // pulls data-source URLs from policy_text + action_mapping with a plain
  // https:// match and nothing else. A policy with no URL in either field
  // deterministically resolves to NO_ACTION on every evaluation, forever --
  // silently, with no revert to explain why. Warn here rather than let a
  // user discover that days later.
  const hasDataSourceUrl = useMemo(
    () => /https?:\/\/\S+/.test(`${policyText} ${actionMapping}`),
    [policyText, actionMapping]
  );

  const canSubmit =
    name.trim().length > 0 &&
    policyText.trim().length > 0 &&
    actionMapping.trim().length > 0 &&
    state.phase === "idle";

  async function handleSubmit() {
    await run(async () => {
      if (!client) throw new Error("Connect a wallet first.");
      return registerPolicy(client, name.trim(), policyText.trim(), actionMapping.trim());
    });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      reset();
      if (state.phase === "success") {
        setName("");
        setPolicyText("");
        setActionMapping("");
        onRegistered?.();
      }
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <Button>Register Policy</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2">
          <div className="glass-panel max-h-[85vh] overflow-y-auto p-6">
            <div className="mb-5 flex items-center justify-between">
              <Dialog.Title className="text-lg font-semibold text-text-primary">
                Register Operational Policy
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="text-text-muted transition-colors hover:text-text-primary" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>

            {state.phase === "idle" ? (
              <div className="flex flex-col gap-4">
                <Field label="Policy name" hint={`${name.length}/${MAX_NAME}`}>
                  <Input
                    value={name}
                    maxLength={MAX_NAME}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Vault Solvency Guard"
                  />
                </Field>
                <Field
                  label="Policy text"
                  hint={`${policyText.length}/${MAX_POLICY_TEXT}`}
                  helper="Include the exact live data URL(s) Helm should check, e.g. 'If the ratio at https://api.example.com/status drops below 150%, pause the vault.'"
                >
                  <Textarea
                    rows={4}
                    value={policyText}
                    maxLength={MAX_POLICY_TEXT}
                    onChange={(e) => setPolicyText(e.target.value)}
                    placeholder="If the collateral ratio reported at https://... drops below 150%, pause the vault."
                  />
                </Field>
                <Field
                  label="Action mapping"
                  hint={`${actionMapping.length}/${MAX_ACTION_MAPPING}`}
                  helper="Describes intent for a downstream keeper/contract reading this decision — Helm itself never calls other contracts."
                >
                  <Textarea
                    rows={3}
                    value={actionMapping}
                    maxLength={MAX_ACTION_MAPPING}
                    onChange={(e) => setActionMapping(e.target.value)}
                    placeholder="PAUSE -> call vault.pause(); NO_ACTION -> do nothing."
                  />
                </Field>
                {(policyText || actionMapping) && !hasDataSourceUrl && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber/40 bg-amber-soft px-3.5 py-2.5 text-xs text-amber">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      No https:// URL detected. Without a data source, Helm will always record
                      NO_ACTION for this policy — see Policy Language guide.
                    </span>
                  </div>
                )}
                <Button onClick={handleSubmit} disabled={!canSubmit} className="mt-2">
                  Sign &amp; Register
                </Button>
              </div>
            ) : (
              <TransactionPanel state={state} onReset={() => handleOpenChange(false)} successLabel="Policy registered on-chain" />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({
  label,
  hint,
  helper,
  children,
}: {
  label: string;
  hint?: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-xs font-medium text-text-secondary">
        {label}
        {hint && <span className="font-mono text-text-muted">{hint}</span>}
      </span>
      {children}
      {helper && <span className="text-xs text-text-muted">{helper}</span>}
    </label>
  );
}

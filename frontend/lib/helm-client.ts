"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import type { GenLayerClient, GenLayerChain, GenLayerTransaction, TransactionHash } from "genlayer-js/types";
import { HELM_METHODS, getHelmAddress, type PolicyRecord, type EvaluationRecord, type HelmContractInfo } from "./helm-abi";

let _readOnlyClient: GenLayerClient<GenLayerChain> | null = null;

/**
 * A wallet-free client for read-only pages (explorer, policy detail) --
 * readContract needs no signer, confirmed working across every prior
 * GenLayer frontend on this stack. Never use this for writes.
 */
export function getReadOnlyHelmClient(): GenLayerClient<GenLayerChain> {
  if (!_readOnlyClient) {
    _readOnlyClient = createClient({ chain: testnetBradbury });
  }
  return _readOnlyClient;
}

export function useHelmClient(): {
  client: GenLayerClient<GenLayerChain> | null;
  address: `0x${string}` | undefined;
} {
  const { address, isConnected, connector } = useAccount();
  const [client, setClient] = useState<GenLayerClient<GenLayerChain> | null>(null);

  // connector.getProvider() returns whichever EIP-1193 provider wagmi
  // actually established the connection through -- matches every connector
  // type (injected, WalletConnect, Coinbase Smart Wallet, Safe), unlike
  // reading window.ethereum directly which only works for a single
  // browser-extension wallet.
  useEffect(() => {
    let cancelled = false;
    if (!isConnected || !address || !connector) {
      setClient(null);
      return;
    }
    connector
      .getProvider()
      .then((provider) => {
        if (cancelled) return;
        setClient(
          createClient({
            chain: testnetBradbury,
            account: address,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            provider: provider as any,
          })
        );
      })
      .catch(() => {
        if (!cancelled) setClient(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isConnected, address, connector]);

  return { client, address };
}

// ---------------------------------------------------------------------
// Reads -- get_policy/get_evaluation/etc. all return dicts, which
// genlayer-js's readContract decodes to plain JSON-safe JS objects by
// default (jsonSafeReturn defaults to true), so no manual JSON parsing is
// needed anywhere below.
// ---------------------------------------------------------------------

export async function fetchPolicy(
  client: GenLayerClient<GenLayerChain>,
  policyId: string
): Promise<PolicyRecord> {
  const result = await client.readContract({
    address: getHelmAddress(),
    functionName: HELM_METHODS.getPolicy,
    args: [policyId],
  });
  return result as unknown as PolicyRecord;
}

export async function fetchEvaluation(
  client: GenLayerClient<GenLayerChain>,
  evaluationId: string
): Promise<EvaluationRecord> {
  const result = await client.readContract({
    address: getHelmAddress(),
    functionName: HELM_METHODS.getEvaluation,
    args: [evaluationId],
  });
  return result as unknown as EvaluationRecord;
}

export async function fetchLatestEvaluation(
  client: GenLayerClient<GenLayerChain>,
  policyId: string
): Promise<EvaluationRecord> {
  const result = await client.readContract({
    address: getHelmAddress(),
    functionName: HELM_METHODS.getLatestEvaluation,
    args: [policyId],
  });
  return result as unknown as EvaluationRecord;
}

export async function fetchPoliciesByOwner(
  client: GenLayerClient<GenLayerChain>,
  ownerAddress: string
): Promise<PolicyRecord[]> {
  const result = await client.readContract({
    address: getHelmAddress(),
    functionName: HELM_METHODS.getPoliciesByOwner,
    args: [ownerAddress],
  });
  return result as unknown as PolicyRecord[];
}

export async function fetchContractInfo(
  client: GenLayerClient<GenLayerChain>
): Promise<HelmContractInfo> {
  const result = await client.readContract({
    address: getHelmAddress(),
    functionName: HELM_METHODS.getContractInfo,
    args: [],
  });
  return result as unknown as HelmContractInfo;
}

// ---------------------------------------------------------------------
// Writes -- every write returns a tx hash; callers drive
// pollConsensusStatus for the full lifecycle UI.
// ---------------------------------------------------------------------

export async function registerPolicy(
  client: GenLayerClient<GenLayerChain>,
  name: string,
  policyText: string,
  actionMapping: string
): Promise<`0x${string}`> {
  const hash = await client.writeContract({
    address: getHelmAddress(),
    functionName: HELM_METHODS.registerPolicy,
    args: [name, policyText, actionMapping],
    value: 0n,
  });
  return hash as `0x${string}`;
}

export async function updatePolicy(
  client: GenLayerClient<GenLayerChain>,
  policyId: string,
  newText: string,
  newMapping: string
): Promise<`0x${string}`> {
  const hash = await client.writeContract({
    address: getHelmAddress(),
    functionName: HELM_METHODS.updatePolicy,
    args: [policyId, newText, newMapping],
    value: 0n,
  });
  return hash as `0x${string}`;
}

export async function deactivatePolicy(
  client: GenLayerClient<GenLayerChain>,
  policyId: string
): Promise<`0x${string}`> {
  const hash = await client.writeContract({
    address: getHelmAddress(),
    functionName: HELM_METHODS.deactivatePolicy,
    args: [policyId],
    value: 0n,
  });
  return hash as `0x${string}`;
}

// evaluate_policy is the heaviest call in this contract: a full nondet
// web-fetch + LLM-reasoning round, re-run independently by every
// validator for Equivalence Principle agreement. Raised above the SDK's
// default consensusMaxRotations (3) for the same reason Vulcan's
// generate() raises it -- more surface for one slow/failed leader attempt
// to eat the default budget before the platform gives up.
const EVALUATE_MAX_ROTATIONS = 5;

export async function evaluatePolicy(
  client: GenLayerClient<GenLayerChain>,
  policyId: string
): Promise<`0x${string}`> {
  const hash = await client.writeContract({
    address: getHelmAddress(),
    functionName: HELM_METHODS.evaluatePolicy,
    args: [policyId],
    value: 0n,
    consensusMaxRotations: EVALUATE_MAX_ROTATIONS,
  });
  return hash as `0x${string}`;
}

// ---------------------------------------------------------------------
// Consensus polling -- drives the live transaction-lifecycle UI directly
// off real chain state, no fabricated timers.
// ---------------------------------------------------------------------

// A read is correct the moment consensus is ACCEPTED; FINALIZED only
// settles the appeal window and can take much longer to arrive. The
// default poll here stops at ACCEPTED (fast UI feedback for reads like
// "did my evaluation go through"); requireFinalized widens this for
// callers that need the stronger "this is now permanent" guarantee.
const TERMINAL_STATUSES = new Set<TransactionStatus>([
  TransactionStatus.ACCEPTED,
  TransactionStatus.FINALIZED,
  TransactionStatus.UNDETERMINED,
  TransactionStatus.CANCELED,
  TransactionStatus.VALIDATORS_TIMEOUT,
  TransactionStatus.LEADER_TIMEOUT,
]);

const FINALIZED_REQUIRED_STATUSES = new Set<TransactionStatus>([
  TransactionStatus.FINALIZED,
  TransactionStatus.UNDETERMINED,
  TransactionStatus.CANCELED,
  TransactionStatus.VALIDATORS_TIMEOUT,
  TransactionStatus.LEADER_TIMEOUT,
]);

export interface ConsensusTick {
  status: TransactionStatus;
  transaction: GenLayerTransaction;
}

const MAX_CONSECUTIVE_RPC_FAILURES = 4;

export class PollCancelledError extends Error {
  constructor() {
    super("Polling was cancelled");
    this.name = "PollCancelledError";
  }
}

/**
 * Polls the real transaction status until a terminal state is reached,
 * invoking onTick on every observed status change. isCancelled is checked
 * before every network call and every sleep so an unmounted caller stops
 * the loop from actually running, not just from reporting status. A single
 * transient RPC failure is tolerated up to MAX_CONSECUTIVE_RPC_FAILURES
 * times before giving up, since one bad request doesn't mean the
 * transaction itself failed.
 *
 * A terminal-looking status is required to be observed on two consecutive
 * polls before it is trusted. Confirmed live (2026-08-19, against
 * transaction 0x13e9de63...c614fcd on the deployed Helm contract): the same
 * transaction hash genuinely reported LEADER_TIMEOUT at one poll and
 * VALIDATORS_TIMEOUT on a later read -- genlayer-js's own DECIDED_STATES
 * classifies both as terminal, but the raw chain status can still change
 * after first reaching one of them (that transaction's `numOfRounds` was 6,
 * evidence of multiple internal processing passes after the first
 * terminal-looking read). Returning on the very first terminal reading can
 * therefore show the user a status that gets superseded moments later.
 * Requiring the same status twice in a row costs at most one extra poll
 * interval in the common case where nothing was actually still settling.
 */
export async function pollConsensusStatus(
  client: GenLayerClient<GenLayerChain>,
  hash: `0x${string}`,
  onTick: (tick: ConsensusTick) => void,
  {
    intervalMs,
    maxAttempts,
    isCancelled = () => false,
    requireFinalized = false,
  }: {
    intervalMs?: number;
    maxAttempts?: number;
    isCancelled?: () => boolean;
    requireFinalized?: boolean;
  } = {}
): Promise<GenLayerTransaction> {
  const terminalStatuses = requireFinalized ? FINALIZED_REQUIRED_STATUSES : TERMINAL_STATUSES;
  const effectiveIntervalMs = intervalMs ?? (requireFinalized ? 5000 : 1500);
  const effectiveMaxAttempts = maxAttempts ?? (requireFinalized ? 100 : 120);
  let lastStatus: TransactionStatus | null = null;
  let pendingTerminalStatus: TransactionStatus | null = null;
  let consecutiveFailures = 0;

  for (let attempt = 0; attempt < effectiveMaxAttempts; attempt++) {
    if (isCancelled()) throw new PollCancelledError();

    let transaction: GenLayerTransaction;
    try {
      transaction = await client.getTransaction({ hash: hash as TransactionHash });
      consecutiveFailures = 0;
    } catch (err) {
      consecutiveFailures += 1;
      if (consecutiveFailures > MAX_CONSECUTIVE_RPC_FAILURES) throw err;
      await new Promise((resolve) => setTimeout(resolve, effectiveIntervalMs));
      continue;
    }

    const status = transaction.statusName ?? TransactionStatus.PENDING;

    if (status !== lastStatus) {
      onTick({ status, transaction });
      lastStatus = status;
    }

    if (terminalStatuses.has(status)) {
      if (pendingTerminalStatus === status) {
        return transaction;
      }
      // First sighting of this terminal status (or it differs from a prior
      // unconfirmed one, e.g. LEADER_TIMEOUT -> VALIDATORS_TIMEOUT) --
      // note it and poll once more before trusting it.
      pendingTerminalStatus = status;
    } else {
      pendingTerminalStatus = null;
    }

    if (isCancelled()) throw new PollCancelledError();
    await new Promise((resolve) => setTimeout(resolve, effectiveIntervalMs));
  }

  throw new Error(
    requireFinalized
      ? "Timed out waiting for the transaction to finalize."
      : "Timed out waiting for transaction to reach a terminal status"
  );
}

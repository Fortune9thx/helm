import { cn } from "@/lib/utils";
import type { HelmDecision } from "@/lib/helm-abi";

const DECISION_STYLES: Record<string, string> = {
  PAUSE: "border-rose/50 bg-rose-soft text-rose",
  ALERT: "border-amber/50 bg-amber-soft text-amber",
  REBALANCE: "border-cyan/50 bg-cyan-soft text-cyan",
  ADJUST_PARAM: "border-cyan/50 bg-cyan-soft text-cyan",
  SWITCH_ORACLE: "border-cyan/50 bg-cyan-soft text-cyan",
  NO_ACTION: "border-border text-text-secondary",
  "": "border-border text-text-muted",
};

const DECISION_LABELS: Record<string, string> = {
  PAUSE: "Pause",
  ALERT: "Alert",
  REBALANCE: "Rebalance",
  ADJUST_PARAM: "Adjust Parameter",
  SWITCH_ORACLE: "Switch Oracle",
  NO_ACTION: "No Action",
  "": "Not Evaluated",
};

export function DecisionBadge({
  decision,
  className,
}: {
  decision: HelmDecision | "" | undefined;
  className?: string;
}) {
  const key = decision ?? "";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-medium tracking-wide",
        DECISION_STYLES[key] ?? DECISION_STYLES[""],
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {DECISION_LABELS[key] ?? key}
    </span>
  );
}

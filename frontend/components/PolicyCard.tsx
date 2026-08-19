import Link from "next/link";
import { Card } from "./ui/card";
import type { PolicyRecord } from "@/lib/helm-abi";

export function PolicyCard({ policy }: { policy: PolicyRecord }) {
  return (
    <Link href={`/policy/${policy.policy_id}`}>
      <Card className="flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-text-primary">{policy.name}</h3>
          <span
            className={
              policy.active
                ? "shrink-0 rounded-full border border-cyan/40 bg-cyan-soft px-2.5 py-0.5 text-[11px] font-medium text-cyan"
                : "shrink-0 rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-text-muted"
            }
          >
            {policy.active ? "Active" : "Deactivated"}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-text-secondary">{policy.policy_text}</p>
        <div className="mt-auto flex items-center justify-between pt-2 font-mono text-xs text-text-muted">
          <span>{policy.eval_count} evaluation{policy.eval_count === "1" ? "" : "s"}</span>
          <span className="text-cyan-dim">View →</span>
        </div>
      </Card>
    </Link>
  );
}

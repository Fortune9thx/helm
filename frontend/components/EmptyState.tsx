import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="glass-panel flex flex-col items-center gap-4 px-8 py-16 text-center">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="opacity-70">
        <circle cx="32" cy="32" r="30" stroke="var(--color-border-strong)" strokeWidth="1" strokeDasharray="4 4" />
        <circle cx="32" cy="32" r="18" stroke="var(--color-cyan)" strokeWidth="1.5" opacity="0.5" />
        <path d="M32 20 L32 32 L40 38" stroke="var(--color-cyan)" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      </svg>
      <div className="max-w-sm">
        <h3 className="text-base font-semibold text-text-primary">{title}</h3>
        <p className="mt-1.5 text-sm text-text-secondary">{description}</p>
      </div>
      {action}
    </div>
  );
}

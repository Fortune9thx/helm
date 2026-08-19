import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-border bg-void-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-colors duration-200 focus:border-border-strong focus:outline-none",
        className
      )}
      {...props}
    />
  );
}

export { Input };

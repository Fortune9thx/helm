import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full resize-none rounded-xl border border-border bg-void-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-colors duration-200 focus:border-border-strong focus:outline-none",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };

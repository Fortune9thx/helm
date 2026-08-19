import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50",
  {
    variants: {
      variant: {
        primary:
          "bg-cyan text-void hover:shadow-[0_0_24px_rgba(0,240,255,0.45)] active:scale-[0.98]",
        secondary:
          "border border-border text-text-primary hover:border-border-strong active:scale-[0.98]",
        amber:
          "bg-amber text-void hover:shadow-[0_0_24px_rgba(255,184,0,0.4)] active:scale-[0.98]",
        danger:
          "border border-rose/50 bg-rose-soft text-rose hover:border-rose active:scale-[0.98]",
        ghost: "text-text-secondary hover:text-text-primary",
      },
      size: {
        default: "h-11 px-6",
        sm: "h-9 px-4 text-xs",
        lg: "h-13 px-8 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };

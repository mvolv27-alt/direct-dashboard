import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 backdrop-blur-sm",
  {
    variants: {
      variant: {
        default:
          "border-primary/30 bg-primary/15 text-primary hover:bg-primary/25 hover:border-primary/50 hover:shadow-[0_0_12px_-2px_hsl(var(--primary)/0.55)]",
        secondary:
          "border-secondary/30 bg-secondary/15 text-secondary hover:bg-secondary/25 hover:border-secondary/50 hover:shadow-[0_0_12px_-2px_hsl(var(--secondary)/0.55)]",
        success:
          "border-success/30 bg-success/15 text-success hover:bg-success/25 hover:border-success/50 hover:shadow-[0_0_12px_-2px_hsl(var(--success)/0.55)]",
        warning:
          "border-warning/30 bg-warning/15 text-warning hover:bg-warning/25 hover:border-warning/50 hover:shadow-[0_0_12px_-2px_hsl(var(--warning)/0.55)]",
        destructive:
          "border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/25 hover:border-destructive/50",
        outline:
          "border-border/60 bg-card/30 text-foreground hover:bg-card/60 hover:border-primary/40",
        solid:
          "border-transparent gradient-primary text-primary-foreground shadow-[0_2px_12px_-2px_hsl(var(--primary)/0.5)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

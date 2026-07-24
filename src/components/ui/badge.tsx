import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-primary/25 bg-primary/10 text-primary hover:bg-primary/15",
        secondary:
          "border-secondary/25 bg-secondary/10 text-secondary hover:bg-secondary/15",
        success:
          "border-success/25 bg-success/10 text-success hover:bg-success/15",
        warning:
          "border-warning/25 bg-warning/10 text-warning hover:bg-warning/15",
        destructive:
          "border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/25 hover:border-destructive/50",
        outline:
          "border-border/60 bg-card/30 text-foreground hover:bg-card/60 hover:border-primary/40",
        solid:
          "border-transparent bg-primary text-primary-foreground shadow-2xs",
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

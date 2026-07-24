import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "gradient-primary text-primary-foreground shadow-[0_10px_26px_hsl(var(--primary)/0.22)] hover:-translate-y-0.5 hover:shadow-[0_14px_34px_hsl(var(--primary)/0.3)]",
        destructive:
          "bg-gradient-to-br from-destructive to-accent text-destructive-foreground shadow-[0_10px_26px_hsl(var(--destructive)/0.2)] hover:-translate-y-0.5 hover:shadow-[0_14px_32px_hsl(var(--destructive)/0.28)]",
        outline:
          "border border-white/60 bg-card/55 text-foreground shadow-2xs backdrop-blur-xl hover:-translate-y-0.5 hover:border-primary/45 hover:bg-card/80 hover:shadow-sm dark:border-white/12",
        secondary:
          "gradient-success text-secondary-foreground shadow-[0_10px_26px_hsl(var(--secondary)/0.2)] hover:-translate-y-0.5 hover:shadow-[0_14px_32px_hsl(var(--secondary)/0.28)]",
        success:
          "bg-gradient-to-br from-success to-secondary text-success-foreground shadow-[0_10px_26px_hsl(var(--success)/0.2)] hover:-translate-y-0.5 hover:shadow-[0_14px_32px_hsl(var(--success)/0.28)]",
        warning:
          "gradient-warning text-warning-foreground shadow-[0_10px_26px_hsl(var(--warning)/0.2)] hover:-translate-y-0.5 hover:shadow-[0_14px_32px_hsl(var(--warning)/0.28)]",
        ghost:
          "text-foreground hover:bg-card/70 hover:text-foreground hover:shadow-2xs",
        link:
          "text-primary underline-offset-4 hover:underline hover:text-primary-glow",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

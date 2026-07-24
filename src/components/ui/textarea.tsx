import * as React from "react";

import { cn } from "@/lib/utils";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full rounded-[14px] border border-border/85 bg-card/82 px-3 py-2 text-sm font-medium text-foreground shadow-2xs backdrop-blur-xl transition-all duration-200 placeholder:text-muted-foreground hover:border-primary/35 hover:bg-card focus-visible:outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/12 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/12 dark:bg-background/36",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };

import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    (<textarea
      className={cn(
        "flex min-h-[88px] w-full rounded-xl border border-input bg-card/72 px-3.5 py-2.5 text-base text-foreground shadow-inner transition-[background-color,border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-accent focus-visible:bg-card focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props} />)
  );
})
Textarea.displayName = "Textarea"

export { Textarea }

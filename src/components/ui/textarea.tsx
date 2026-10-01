import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full px-4 py-3 rounded-xs border border-outline bg-transparent text-base text-on-surface transition-colors outline-none placeholder:text-on-surface-variant hover:border-on-surface disabled:cursor-not-allowed disabled:opacity-38 aria-invalid:border-destructive md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

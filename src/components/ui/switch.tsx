import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border-2 transition-colors duration-200 outline-none after:absolute after:-inset-x-3 after:-inset-y-2 aria-invalid:border-destructive data-[size=default]:h-8 data-[size=default]:w-[52px] data-[size=sm]:h-6 data-[size=sm]:w-10 data-checked:border-primary data-checked:bg-primary data-unchecked:border-outline data-unchecked:bg-surface-container-highest data-disabled:cursor-not-allowed data-disabled:opacity-38",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        // The thumb grows from 16 to 24px as it travels to the checked side.
        className="pointer-events-none block rounded-full ring-0 transition-all duration-200 ease-emphasized data-checked:bg-on-primary data-unchecked:bg-outline group-data-[size=default]/switch:data-checked:size-6 group-data-[size=default]/switch:data-checked:translate-x-[22px] rtl:group-data-[size=default]/switch:data-checked:-translate-x-[22px] group-data-[size=default]/switch:data-unchecked:size-4 group-data-[size=default]/switch:data-unchecked:translate-x-1.5 rtl:group-data-[size=default]/switch:data-unchecked:-translate-x-1.5 group-data-[size=sm]/switch:data-checked:size-4 group-data-[size=sm]/switch:data-checked:translate-x-[18px] rtl:group-data-[size=sm]/switch:data-checked:-translate-x-[18px] group-data-[size=sm]/switch:data-unchecked:size-3 group-data-[size=sm]/switch:data-unchecked:translate-x-1 rtl:group-data-[size=sm]/switch:data-unchecked:-translate-x-1"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Material 3 common buttons. `default` is the filled button, `secondary` the
// filled tonal one, `outline` the outlined one and `ghost` the text button.
// The hover / focus / press state layer comes from the base styles in index.css.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-200 ease-emphasized select-none disabled:pointer-events-none disabled:opacity-38 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:shadow-e1",
        outline:
          "border-outline bg-transparent text-primary aria-expanded:bg-primary/8",
        secondary:
          "bg-secondary-container text-on-secondary-container hover:shadow-e1",
        ghost: "bg-transparent text-primary aria-expanded:bg-primary/8",
        destructive: "bg-error-container text-on-error-container",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-2 px-6 has-data-[icon=inline-end]:pe-4 has-data-[icon=inline-start]:ps-4",
        xs: "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-4 text-[0.8rem] has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-12 gap-2 px-8 text-base has-data-[icon=inline-end]:pe-6 has-data-[icon=inline-start]:ps-6",
        icon: "size-10 [&_svg:not([class*='size-'])]:size-6",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-[18px]",
        "icon-lg": "size-12 [&_svg:not([class*='size-'])]:size-6",
      },
    },
    compoundVariants: [
      // A standard icon button carries its icon in the neutral variant colour.
      {
        variant: "ghost",
        size: ["icon", "icon-xs", "icon-sm", "icon-lg"],
        className: "text-on-surface-variant",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

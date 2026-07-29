import { cva, type VariantProps } from "class-variance-authority"
import { useRender } from "@base-ui/react/use-render"
import { mergeProps } from "@base-ui/react/merge-props"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ease-out outline-none hover:-translate-y-px active:translate-y-0 active:scale-[0.98] focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:translate-y-0 disabled:scale-100 disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-200 [&_svg]:ease-out hover:[&_svg]:scale-105 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Pílula branca sólida — ação primária / estado ativo
        default:
          "bg-accent-active text-accent-active-foreground shadow-pill hover:bg-accent-active/90 active:bg-accent-active/80",
        destructive:
          "bg-destructive/85 text-white hover:bg-destructive focus-visible:ring-destructive/30",
        outline:
          "border border-hairline bg-surface-raise-1 shadow-inner-light hover:border-hairline-strong hover:bg-surface-hover hover:text-foreground",
        secondary:
          "border border-hairline bg-surface-raise-2 text-secondary-foreground shadow-inner-light hover:bg-surface-hover",
        ghost:
          "text-foreground/70 hover:bg-surface-hover hover:text-foreground",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-lg px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-premium px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface ButtonProps
  extends useRender.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {}

function Button({
  className,
  variant = "default",
  size = "default",
  render = <button />,
  ...props
}: ButtonProps) {
  const defaultProps = {
    "data-slot": "button",
    "data-variant": variant,
    "data-size": size,
    className: cn(buttonVariants({ variant, size, className })),
  }

  return useRender({
    defaultTagName: "button",
    render,
    props: mergeProps<"button">(defaultProps, props),
  })
}

export { Button, buttonVariants }

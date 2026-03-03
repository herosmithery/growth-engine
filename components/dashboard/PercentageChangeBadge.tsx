import { cva } from "class-variance-authority"
import { TrendingDown, TrendingUp } from "lucide-react"

import type { VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export const percentageChangeBadgeVariants = cva("gap-0.5 inline-flex items-center", {
  variants: {
    variant: {
      default:
        "data-[non-negative=true]:bg-success data-[non-negative=false]:bg-destructive text-white",
      ghost:
        "bg-transparent text-sm data-[non-negative=true]:text-success data-[non-negative=false]:text-destructive",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

function formatPercent(value: number): string {
  return `${Math.abs(value).toFixed(1)}%`
}

function isNonNegative(value: number): boolean {
  return value >= 0
}

interface PercentageChangeBadgeProps
  extends Omit<ComponentProps<"span">, "children">,
    VariantProps<typeof percentageChangeBadgeVariants> {
  value: number
}

export function PercentageChangeBadge({
  value,
  className,
  variant = "default",
  ...props
}: PercentageChangeBadgeProps) {
  const isNonNegativeChange = isNonNegative(value)

  return (
    <span
      className={cn(percentageChangeBadgeVariants({ variant }), className)}
      data-non-negative={isNonNegativeChange}
      {...props}
    >
      {isNonNegativeChange && <span>+</span>}
      <span>{formatPercent(value)}</span>
      <span className="ml-0.5" aria-hidden>
        {isNonNegativeChange ? (
          <TrendingUp className="size-3.5" />
        ) : (
          <TrendingDown className="size-3.5" />
        )}
      </span>
    </span>
  )
}

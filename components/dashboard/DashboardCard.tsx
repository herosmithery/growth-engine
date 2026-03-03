"use client"

import { cva } from "class-variance-authority"
import { EllipsisVertical } from "lucide-react"

import type { VariantProps } from "class-variance-authority"
import type { ComponentProps, ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PercentageChangeBadge } from "./PercentageChangeBadge"

export const cardContentVariants = cva(
  "flex flex-col justify-between gap-y-6",
  {
    variants: {
      size: {
        xs: "h-32",
        sm: "h-64",
        default: "h-96",
        lg: "h-[29rem]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

interface DashboardCardProps extends ComponentProps<"div"> {
  title: string
  period?: string
  action?: ReactNode
  contentClassName?: string
  size?: VariantProps<typeof cardContentVariants>["size"]
}

export function DashboardCard({
  title,
  period,
  action,
  children,
  contentClassName,
  size,
  className,
  ...props
}: DashboardCardProps) {
  return (
    <Card className={className} {...props}>
      <article>
        <div className="flex justify-between p-6">
          <div>
            <CardTitle>{title}</CardTitle>
            {period && <CardDescription>{period}</CardDescription>}
          </div>
          {action}
        </div>
        <CardContent
          className={cn(cardContentVariants({ size }), contentClassName)}
        >
          {children}
        </CardContent>
      </article>
    </Card>
  )
}

type FormatStyleType = "regular" | "currency" | "percent" | "compact"

function formatOverviewCardValue(value: number, formatStyle: FormatStyleType): string {
  switch (formatStyle) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    case "percent":
      return `${value.toFixed(1)}%`
    case "compact":
      return new Intl.NumberFormat("en-US", {
        notation: "compact",
        compactDisplay: "short",
      }).format(value)
    default:
      return new Intl.NumberFormat("en-US").format(value)
  }
}

interface DashboardOverviewCardProps extends ComponentProps<"div"> {
  data: {
    value: number
    percentageChange?: number
  }
  title: string
  period?: string
  action?: ReactNode
  icon: LucideIcon
  formatStyle?: FormatStyleType
  contentClassName?: string
}

export function DashboardOverviewCard({
  data,
  title,
  period,
  action,
  icon: Icon,
  formatStyle = "regular",
  className,
  contentClassName,
  ...props
}: DashboardOverviewCardProps) {
  const value = formatOverviewCardValue(data.value, formatStyle)

  return (
    <Card
      className={cn("flex flex-col justify-between", className)}
      {...props}
    >
      <article>
        <div className="flex justify-between p-6">
          <div>
            <CardTitle className="inline-flex items-center gap-x-1.5 text-sm font-medium text-muted-foreground">
              <Icon className="size-4" aria-hidden />
              <span>{title}</span>
            </CardTitle>
            {period && <CardDescription className="mt-1">{period}</CardDescription>}
          </div>
          {action}
        </div>
        <CardContent className={cn("space-y-1", contentClassName)}>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          {data.percentageChange !== undefined && (
            <PercentageChangeBadge variant="ghost" value={data.percentageChange} />
          )}
        </CardContent>
      </article>
    </Card>
  )
}

interface DashboardOverviewCardV2Props extends ComponentProps<"div"> {
  data: {
    value: number
    percentageChange?: number
  }
  title: string
  period: string
  action?: ReactNode
  icon: LucideIcon
  iconColor?: string
  formatStyle?: FormatStyleType
  contentClassName?: string
}

export function DashboardOverviewCardV2({
  data,
  title,
  period,
  action,
  icon: Icon,
  iconColor = "hsl(var(--primary))",
  formatStyle = "regular",
  className,
  contentClassName,
  ...props
}: DashboardOverviewCardV2Props) {
  const value = formatOverviewCardValue(data.value, formatStyle)

  return (
    <Card
      className={cn("flex flex-col justify-between", className)}
      {...props}
    >
      <article>
        <div className="flex justify-between p-6">
          <div className="flex items-center gap-x-3">
            <Badge
              style={{ backgroundColor: iconColor }}
              className="size-12 aspect-square flex items-center justify-center rounded-xl"
              aria-hidden
            >
              <Icon className="size-6 text-white" />
            </Badge>
            <div>
              <CardDescription>{period}</CardDescription>
              {data.percentageChange !== undefined && (
                <PercentageChangeBadge
                  variant="ghost"
                  value={data.percentageChange}
                  className="p-0"
                />
              )}
            </div>
          </div>
          {action}
        </div>
        <CardContent className={cn("space-y-1", contentClassName)}>
          <CardTitle className="text-muted-foreground font-normal text-sm">
            {title}
          </CardTitle>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
        </CardContent>
      </article>
    </Card>
  )
}

interface DashboardOverviewCardV3Props extends ComponentProps<"div"> {
  data: {
    value: number
    percentageChange?: number
  }
  title: string
  action?: ReactNode
  chart: ReactNode
  formatStyle?: FormatStyleType
  contentClassName?: string
}

export function DashboardOverviewCardV3({
  data,
  title,
  action,
  chart,
  formatStyle = "regular",
  contentClassName,
  className,
  ...props
}: DashboardOverviewCardV3Props) {
  const value = formatOverviewCardValue(data.value, formatStyle)

  return (
    <Card
      className={cn("flex flex-col justify-between", className)}
      {...props}
    >
      <article>
        <div className="flex justify-between p-6 pb-3">
          <div>
            <CardTitle className="text-muted-foreground font-normal text-sm">
              {title}
            </CardTitle>
            <div className="inline-flex flex-wrap items-baseline gap-x-1">
              <p className="text-2xl font-semibold tracking-tight">{value}</p>
              {data.percentageChange !== undefined && (
                <PercentageChangeBadge
                  variant="ghost"
                  value={data.percentageChange}
                  className="p-0"
                />
              )}
            </div>
          </div>
          {action}
        </div>
        <CardContent
          className={cn(
            "flex justify-center items-center p-0",
            contentClassName
          )}
        >
          {chart}
        </CardContent>
      </article>
    </Card>
  )
}

export function DashboardCardActionsDropdown({
  children,
  ...props
}: ComponentProps<typeof DropdownMenu>) {
  return (
    <DropdownMenu {...props}>
      <DropdownMenuTrigger
        aria-label="More actions"
        className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-accent transition-colors -mt-2 -me-2"
      >
        <EllipsisVertical className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {children ? (
          children
        ) : (
          <>
            <DropdownMenuItem>Last week</DropdownMenuItem>
            <DropdownMenuItem disabled>Last month</DropdownMenuItem>
            <DropdownMenuItem>Last year</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { IconBackground } from "@/components/ui/icon-background"
import { cn } from "@/lib/utils"

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: string | number
  icon: React.ReactNode
  color?: "blue" | "green" | "purple" | "pink" | "orange"
  secondaryValue?: string
  trend?: "up" | "down" | "neutral"
  trendValue?: string
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({
    className,
    label,
    value,
    icon,
    color = "blue",
    secondaryValue,
    trend,
    trendValue,
    ...props
  }, ref) => {
    return (
      <Card
        ref={ref}
        className={cn("card-hover overflow-hidden", className)}
        {...props}
      >
        <CardContent className="p-6">
          <div className="flex items-start justify-between space-x-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                {label}
              </p>
              <div className="flex items-baseline space-x-2">
                <h3 className="text-3xl font-bold tracking-tight stat-pulse">
                  {value}
                </h3>
                {secondaryValue && (
                  <span className="text-sm text-muted-foreground">
                    {secondaryValue}
                  </span>
                )}
              </div>
              {trendValue && (
                <div className={cn(
                  "text-xs font-medium mt-1",
                  trend === "up" && "text-success",
                  trend === "down" && "text-destructive",
                  trend === "neutral" && "text-muted-foreground"
                )}>
                  {trendValue}
                </div>
              )}
            </div>
            <IconBackground color={color} size="lg">
              {icon}
            </IconBackground>
          </div>
        </CardContent>
      </Card>
    )
  }
)
StatCard.displayName = "StatCard"

export { StatCard }

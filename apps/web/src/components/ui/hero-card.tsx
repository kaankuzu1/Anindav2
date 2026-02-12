import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface HeroCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: string | React.ReactNode
  subtitle?: string
  icon?: React.ReactNode
  gradient?: "green" | "blue" | "purple" | "custom"
  actionButton?: React.ReactNode
}

const gradientClasses = {
  green: "bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950/20 dark:via-emerald-950/20 dark:to-teal-950/20",
  blue: "bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 dark:from-blue-950/20 dark:via-sky-950/20 dark:to-cyan-950/20",
  purple: "bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50 dark:from-purple-950/20 dark:via-violet-950/20 dark:to-indigo-950/20",
  custom: ""
}

const HeroCard = React.forwardRef<HTMLDivElement, HeroCardProps>(
  ({
    className,
    title,
    subtitle,
    icon,
    gradient = "green",
    actionButton,
    ...props
  }, ref) => {
    return (
      <Card
        ref={ref}
        className={cn(
          "relative overflow-hidden border-0",
          gradientClasses[gradient],
          className
        )}
        {...props}
      >
        <CardContent className="p-8 md:p-12">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-6 md:space-y-0 md:space-x-8">
            <div className="flex-1 text-center md:text-left">
              {typeof title === 'string' ? (
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
                  {title}
                </h2>
              ) : (
                title
              )}
              {subtitle && (
                <p className="text-lg text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
            {icon && (
              <div className="flex-shrink-0">
                <div className="h-24 w-24 md:h-32 md:w-32 rounded-full bg-white/50 dark:bg-white/10 flex items-center justify-center text-5xl md:text-6xl">
                  {icon}
                </div>
              </div>
            )}
          </div>
          {actionButton && (
            <div className="mt-8 flex justify-center md:justify-start">
              {actionButton}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }
)
HeroCard.displayName = "HeroCard"

export { HeroCard }

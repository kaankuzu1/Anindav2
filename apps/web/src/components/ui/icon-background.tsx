import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const iconBackgroundVariants = cva(
  "inline-flex items-center justify-center rounded-full",
  {
    variants: {
      color: {
        blue: "bg-[hsl(var(--stat-blue-bg))] text-[hsl(var(--stat-blue))]",
        green: "bg-[hsl(var(--stat-green-bg))] text-[hsl(var(--stat-green))]",
        purple: "bg-[hsl(var(--stat-purple-bg))] text-[hsl(var(--stat-purple))]",
        pink: "bg-[hsl(var(--stat-pink-bg))] text-[hsl(var(--stat-pink))]",
        orange: "bg-[hsl(var(--stat-orange-bg))] text-[hsl(var(--stat-orange))]",
      },
      size: {
        sm: "h-8 w-8 p-1.5",
        md: "h-12 w-12 p-3",
        lg: "h-16 w-16 p-4",
        xl: "h-20 w-20 p-5",
      },
    },
    defaultVariants: {
      color: "blue",
      size: "md",
    },
  }
)

export interface IconBackgroundProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>,
    VariantProps<typeof iconBackgroundVariants> {
  children: React.ReactNode
}

const IconBackground = React.forwardRef<HTMLDivElement, IconBackgroundProps>(
  ({ className, color, size, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(iconBackgroundVariants({ color, size, className }))}
        {...props}
      >
        {children}
      </div>
    )
  }
)
IconBackground.displayName = "IconBackground"

export { IconBackground, iconBackgroundVariants }


import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  // Explicitly destructure `value` from props, and use `...restProps` for the remainder
  ({ className, type, value, ...restProps }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        // Ensure the value passed to the native input is never undefined if a value prop is intended.
        // If `value` is undefined or null, use an empty string to keep it controlled.
        value={value ?? ""}
        {...restProps}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }


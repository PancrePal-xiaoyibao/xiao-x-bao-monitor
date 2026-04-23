import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "glass" | "glassStrong" | "solid" | "ghost";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  glass:
    "liquid-glass text-white hover:bg-white/10",
  glassStrong:
    "liquid-glass-strong text-white hover:bg-white/10",
  solid:
    "bg-white text-black hover:bg-white/90",
  ghost:
    "bg-transparent text-white hover:bg-white/5",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "glass", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "relative inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium font-body transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "glass" | "solid";
}

export function Badge({ className, variant = "glass", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-3.5 py-1 text-xs font-medium font-body",
        variant === "glass" ? "liquid-glass text-white" : "bg-white text-black",
        className,
      )}
      {...props}
    />
  );
}

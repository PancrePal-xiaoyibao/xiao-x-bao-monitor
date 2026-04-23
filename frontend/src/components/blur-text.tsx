import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface BlurTextProps {
  text: string;
  className?: string;
  by?: "word" | "letter";
  delay?: number;
  direction?: "bottom" | "top";
}

export function BlurText({
  text,
  className,
  by = "word",
  delay = 0.2,
  direction = "bottom",
}: BlurTextProps) {
  const ref = useRef<HTMLHeadingElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const pieces = useMemo(() => {
    if (by === "letter") {
      return Array.from(text);
    }
    return text.split(" ");
  }, [by, text]);

  const initialY = direction === "bottom" ? 50 : -50;
  const midY = direction === "bottom" ? -5 : 5;

  return (
    <h1 ref={ref} className={cn("flex flex-wrap", className)}>
      {pieces.map((piece, index) => (
        <motion.span
          key={`${piece}-${index}`}
          className={cn("inline-block will-change-transform", by === "word" && "mr-[0.28em]")}
          initial={{ filter: "blur(10px)", opacity: 0, y: initialY }}
          animate={
            isVisible
              ? {
                  filter: ["blur(10px)", "blur(5px)", "blur(0px)"],
                  opacity: [0, 0.5, 1],
                  y: [initialY, midY, 0],
                }
              : undefined
          }
          transition={{
            delay: index * delay,
            duration: 1.05,
            times: [0, 0.5, 1],
            ease: "easeOut",
          }}
        >
          {piece === " " ? "\u00A0" : piece}
        </motion.span>
      ))}
    </h1>
  );
}

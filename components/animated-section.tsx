"use client"

import { ReactNode } from "react"
import { useFadeIn, useSlideIn, useScrollAnimation } from "@/hooks/use-gsap"

interface AnimatedSectionProps {
  children: ReactNode
  animation?: "fadeIn" | "slideIn"
  direction?: "left" | "right" | "up" | "down"
  delay?: number
  duration?: number
  scrollTrigger?: boolean
  className?: string
}

export function AnimatedSection({
  children,
  animation = "fadeIn",
  direction = "up",
  delay = 0,
  duration = 1,
  scrollTrigger = false,
  className = "",
}: AnimatedSectionProps) {
  const fadeInRef = useFadeIn(delay, duration)
  const slideInRef = useSlideIn(direction, delay, duration)
  const scrollRef = useScrollAnimation(
    "scroll-animation",
    { opacity: 1, y: 0 },
    delay
  )

  const ref = scrollTrigger ? scrollRef : animation === "fadeIn" ? fadeInRef : slideInRef

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

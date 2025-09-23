"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

// Register GSAP plugins
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger)
}

export function useGSAP() {
  const isMobile = useRef(false)

  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      isMobile.current = window.innerWidth < 768
    }
    
    checkMobile()
    window.addEventListener("resize", checkMobile)
    
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  return {
    gsap,
    ScrollTrigger,
    isMobile: isMobile.current,
  }
}

// Hook for fade in animations
export function useFadeIn(delay = 0, duration = 1) {
  const ref = useRef<HTMLDivElement>(null)
  const { gsap, isMobile } = useGSAP()

  useEffect(() => {
    if (!ref.current || isMobile) return

    gsap.fromTo(
      ref.current,
      {
        opacity: 0,
        y: 30,
      },
      {
        opacity: 1,
        y: 0,
        duration,
        delay,
        ease: "power2.out",
      }
    )
  }, [delay, duration, gsap, isMobile])

  return ref
}

// Hook for slide in animations
export function useSlideIn(direction: "left" | "right" | "up" | "down" = "up", delay = 0, duration = 1) {
  const ref = useRef<HTMLDivElement>(null)
  const { gsap, isMobile } = useGSAP()

  useEffect(() => {
    if (!ref.current || isMobile) return

    const directions = {
      left: { x: -50, y: 0 },
      right: { x: 50, y: 0 },
      up: { x: 0, y: 50 },
      down: { x: 0, y: -50 },
    }

    gsap.fromTo(
      ref.current,
      {
        opacity: 0,
        ...directions[direction],
      },
      {
        opacity: 1,
        x: 0,
        y: 0,
        duration,
        delay,
        ease: "power2.out",
      }
    )
  }, [direction, delay, duration, gsap, isMobile])

  return ref
}

// Hook for scroll-triggered animations
export function useScrollAnimation(trigger: string, animation: any, delay = 0) {
  const ref = useRef<HTMLDivElement>(null)
  const { gsap, ScrollTrigger, isMobile } = useGSAP()

  useEffect(() => {
    if (!ref.current || isMobile) return

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: ref.current,
        start: "top 80%",
        end: "bottom 20%",
        toggleActions: "play none none reverse",
      },
    })

    tl.to(ref.current, {
      ...animation,
      duration: 1,
      delay,
      ease: "power2.out",
    })

    return () => {
      tl.kill()
    }
  }, [trigger, animation, delay, gsap, ScrollTrigger, isMobile])

  return ref
}

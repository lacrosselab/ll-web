"use client"

import { useState, useEffect } from "react"

export function RichmondClock() {
  const [time, setTime] = useState<string>("")
  const [date, setDate] = useState<string>("")

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      
      // Convert to Richmond, VA time (Eastern Time)
      const richmondTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
      
      // Format time
      const timeString = richmondTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
      
      // Format date
      const dateString = richmondTime.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
      
      setTime(timeString)
      setDate(dateString)
    }

    // Update immediately
    updateTime()
    
    // Update every second
    const interval = setInterval(updateTime, 1000)
    
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="text-center">
      <div className="text-xs font-mono text-navy/80">
        Richmond, VA
      </div>
      <div className="text-sm font-mono font-semibold text-navy">
        {time}
      </div>
    </div>
  )
}

export function calculateRaffleStatus(startDate: string, endDate: string): "upcoming" | "active" | "ended" {
  const now = new Date()
  const start = new Date(startDate)
  const end = new Date(endDate)

  if (now < start) {
    return "upcoming"
  } else if (now >= start && now < end) {
    return "active"
  } else {
    return "ended"
  }
}

export function isEndingSoon(endDate: string): boolean {
  const now = new Date()
  const end = new Date(endDate)
  const oneHourInMs = 60 * 60 * 1000
  const timeRemaining = end.getTime() - now.getTime()

  return timeRemaining > 0 && timeRemaining <= oneHourInMs
}

export function getTimeRemaining(endDate: string): {
  days: number
  hours: number
  minutes: number
  seconds: number
  expired: boolean
} {
  const now = new Date()
  const end = new Date(endDate)
  const timeRemaining = end.getTime() - now.getTime()

  if (timeRemaining <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
  }

  const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24))
  const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000)

  return { days, hours, minutes, seconds, expired: false }
}

export function formatDrawDate(drawDate: string): string {
  const date = new Date(drawDate)
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

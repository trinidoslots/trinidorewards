export function calculateLeaderboardStatus(startDate: string, endDate: string): "upcoming" | "active" | "ended" {
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

export function getStatusColor(status: "upcoming" | "active" | "ended"): string {
  switch (status) {
    case "active":
      return "text-green-400"
    case "ended":
      return "text-red-400"
    case "upcoming":
      return "text-amber-400"
  }
}

export function getStatusBadgeClass(status: "upcoming" | "active" | "ended"): string {
  switch (status) {
    case "active":
      return "bg-green-500/20 text-green-400 border-green-500/30"
    case "ended":
      return "bg-red-500/20 text-red-400 border-red-500/30"
    case "upcoming":
      return "bg-amber-500/20 text-amber-400 border-amber-500/30"
  }
}

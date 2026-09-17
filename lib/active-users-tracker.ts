import { createServerClient } from "@/lib/supabase/server"

interface ActiveUser {
  username: string
  kick_id: string
  last_activity: Date
  timer_expiration: Date
}

// Map to store active users in memory (5-minute windows)
const activeUsersMap = new Map<string, ActiveUser>()

// Cleanup interval - runs every 30 seconds to remove expired entries
setInterval(() => {
  const now = new Date()
  for (const [username, user] of activeUsersMap.entries()) {
    if (now > user.timer_expiration) {
      activeUsersMap.delete(username)
    }
  }
}, 30000)

export async function trackActiveUser(username: string, kick_id: string) {
  const now = new Date()
  const expiration = new Date(now.getTime() + 5 * 60 * 1000) // 5 minutes from now

  // Add or update user in active map
  activeUsersMap.set(username, {
    username,
    kick_id,
    last_activity: now,
    timer_expiration: expiration,
  })

  // Update database for persistence
  try {
    const supabase = await createServerClient()
    await supabase.from("user_messages").upsert(
      {
        username,
        kick_id,
        last_message_time: now.toISOString(),
      },
      { onConflict: "username" }
    )
  } catch (error) {
    console.error("Error updating user activity in database:", error)
  }
}

export function getActiveUsers(): ActiveUser[] {
  const now = new Date()
  const active: ActiveUser[] = []

  for (const user of activeUsersMap.values()) {
    if (now <= user.timer_expiration) {
      active.push(user)
    }
  }

  return active
}

export function getActiveUsernames(): string[] {
  return getActiveUsers().map((u) => u.username)
}

export function isUserActive(username: string): boolean {
  const user = activeUsersMap.get(username)
  if (!user) return false

  const now = new Date()
  return now <= user.timer_expiration
}

export function getUserTimerExpiration(username: string): Date | null {
  const user = activeUsersMap.get(username)
  return user ? user.timer_expiration : null
}

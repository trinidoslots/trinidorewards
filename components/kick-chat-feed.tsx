"use client"

import { useEffect, useRef } from "react"
import { CHAT_EMOTE_PX, CHAT_FONT_PX, OBS, OBS_RADIUS } from "@/lib/obs-theme"
import { emoteImageUrl, parseMessageContent, type KickBadge, type KickMessage } from "@/lib/kick-chat"

// Kick's own badge palette, so the feed reads as Kick rather than as our theme.
const BADGE_COLORS: Record<string, string> = {
  broadcaster: "#E8437D",
  moderator: "#00C7FF",
  verified: "#53FC18",
  vip: "#E8B43C",
  og: "#1ED3A3",
  founder: "#F5A623",
  staff: "#6B5BFF",
  sub_gifter: "#9147FF",
  subscriber: "#4C8BF5",
}

// Subscriber badges are tinted by tenure on Kick, so a long-standing sub reads
// differently from a new one at a glance.
const SUB_TIERS: { months: number; color: string }[] = [
  { months: 24, color: "#E8437D" },
  { months: 12, color: "#F5A623" },
  { months: 6, color: "#1ED3A3" },
  { months: 3, color: "#9147FF" },
  { months: 0, color: "#4C8BF5" },
]

function badgeColor(badge: KickBadge) {
  if (badge.type === "subscriber") {
    const months = badge.count ?? 1
    return SUB_TIERS.find((tier) => months >= tier.months)!.color
  }
  return BADGE_COLORS[badge.type] ?? "#8B8B8B"
}

// Kick renders the subscriber badge as the month count in a coloured tile and
// every other badge as a glyph. Approximating the glyphs with the badge's first
// letter keeps the row height and rhythm identical without shipping Kick's SVGs.
function BadgeTile({ badge }: { badge: KickBadge }) {
  const label = badge.type === "subscriber" ? String(badge.count ?? 1) : badge.type.charAt(0).toUpperCase()

  return (
    <span
      title={badge.text ?? badge.type}
      className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center px-[4px] text-[11px] font-extrabold leading-none text-white"
      style={{ backgroundColor: badgeColor(badge), borderRadius: OBS_RADIUS.badge }}
    >
      {label}
    </span>
  )
}

function MessageContent({ content }: { content: string }) {
  return (
    <>
      {parseMessageContent(content).map((part, index) =>
        part.kind === "text" ? (
          <span key={index}>{part.text}</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- external Kick emote host
          <img
            key={index}
            src={emoteImageUrl(part.id)}
            alt={part.name}
            title={part.name}
            loading="lazy"
            className="mx-[2px] inline-block w-auto align-middle"
            style={{ height: CHAT_EMOTE_PX, maxWidth: CHAT_EMOTE_PX * 3 }}
          />
        ),
      )}
    </>
  )
}

export function KickChatFeed({ messages, className }: { messages: KickMessage[]; className?: string }) {
  const feedRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true)

  // Stay pinned to the newest message the way a live chat does, but stop forcing
  // it if something scrolled the feed up — otherwise a scroll would fight back
  // on every incoming message.
  useEffect(() => {
    const feed = feedRef.current
    if (!feed || !pinnedRef.current) return
    feed.scrollTop = feed.scrollHeight
  }, [messages])

  const handleScroll = () => {
    const feed = feedRef.current
    if (!feed) return
    pinnedRef.current = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 40
  }

  return (
    <div
      ref={feedRef}
      onScroll={handleScroll}
      className={`flex flex-col overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className ?? ""}`}
      style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: CHAT_FONT_PX }}
    >
      {messages.map((message) => (
        <div key={message.id} className="break-words px-[10px] py-[5px] leading-[1.45]"
          style={{ color: OBS.chatText }}>
          {message.badges.length > 0 && (
            <span className="mr-[6px] inline-flex items-center gap-[4px] align-middle">
              {message.badges.map((badge, index) => (
                <BadgeTile key={`${badge.type}-${index}`} badge={badge} />
              ))}
            </span>
          )}
          <span className="font-bold" style={{ color: message.color }}>
            {message.username}
          </span>
          <span style={{ color: OBS.muted }}>: </span>
          <MessageContent content={message.content} />
        </div>
      ))}
    </div>
  )
}

"use client"

import { useEffect, useRef } from "react"
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

function badgeColor(type: string) {
  return BADGE_COLORS[type] ?? "#8B8B8B"
}

// Kick renders the subscriber badge as the month count in a coloured pill and
// every other badge as a glyph. Approximating the glyphs with the badge's first
// letter keeps the row height and rhythm identical without shipping Kick's SVGs.
function BadgePill({ badge }: { badge: KickBadge }) {
  const color = badgeColor(badge.type)
  const label = badge.type === "subscriber" ? String(badge.count ?? 1) : badge.type.charAt(0).toUpperCase()

  return (
    <span
      title={badge.text ?? badge.type}
      className="inline-flex h-[15px] min-w-[15px] shrink-0 items-center justify-center rounded-[3px] px-[3px] text-[9px] font-bold leading-none text-black"
      style={{ backgroundColor: color }}
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
            className="mx-[2px] inline-block h-[22px] w-auto max-w-[70px] align-middle"
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
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {messages.map((message) => (
        <div
          key={message.id}
          className="break-words px-[10px] py-[5px] text-[13px] leading-[1.4] text-[#E5E7EB]"
        >
          {message.badges.length > 0 && (
            <span className="mr-[5px] inline-flex items-center gap-[3px] align-middle">
              {message.badges.map((badge, index) => (
                <BadgePill key={`${badge.type}-${index}`} badge={badge} />
              ))}
            </span>
          )}
          <span className="font-bold" style={{ color: message.color }}>
            {message.username}
          </span>
          <span className="text-[#9CA3AF]">: </span>
          <MessageContent content={message.content} />
        </div>
      ))}
    </div>
  )
}

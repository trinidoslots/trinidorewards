"use client"

import { useEffect, useRef } from "react"
import { CHAT_EMOTE_PX, CHAT_FONT_PX, OBS, OBS_RADIUS } from "@/lib/obs-theme"
import { emoteImageUrl, parseMessageContent, type KickBadge, type KickMessage } from "@/lib/kick-chat"

/**
 * Badges Kick draws as artwork, by the type it sends.
 *
 * These used to be approximated: a coloured tile with the badge's first letter
 * in it, and the month count for a sub. On stream that read as a row of
 * random letters, nothing like the icons people see in Kick's own chat. The
 * files in public/kick-badges are Kick's real ones, taken from the icon set
 * in its web client, 20x20 viewBox and gradients as they are there.
 *
 * Served as files rather than inlined: every icon names its gradients by id
 * (ModeratorBadge__a and so on), and fifty inlined copies in one feed would be
 * fifty elements sharing each id.
 *
 * Subscribers get Kick's default star because the channel has no custom sub
 * badges. If it ever uploads some, Kick will draw those instead and this will
 * not.
 */
const BADGE_ICONS = new Set(["broadcaster", "moderator", "vip", "subscriber", "og", "verified", "staff"])

// A badge type with no icon above still gets a tile, in Kick's colour for it
// where known, so something new from Kick shows up as something.
const FALLBACK_COLORS: Record<string, string> = {
  founder: "#F5A623",
  sub_gifter: "#9147FF",
}

function BadgeTile({ badge }: { badge: KickBadge }) {
  const title = badge.text ?? badge.type

  if (BADGE_ICONS.has(badge.type)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a static SVG, nothing to optimise
      <img
        src={`/kick-badges/${badge.type}.svg`}
        alt={title}
        title={title}
        className="inline-block h-[18px] w-[18px] shrink-0"
      />
    )
  }

  return (
    <span
      title={title}
      className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center px-[4px] text-[11px] font-extrabold leading-none text-white"
      style={{ backgroundColor: FALLBACK_COLORS[badge.type] ?? "#8B8B8B", borderRadius: OBS_RADIUS.badge }}
    >
      {badge.type.charAt(0).toUpperCase()}
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

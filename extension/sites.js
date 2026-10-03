// sites.js — one adapter per casino. content.js picks the adapter whose
// `hosts` matches the page and only ever talks to the page through it.
//
// An adapter answers:
//   getSlot()    -> { slotName, provider, imageUrl } on a game page, else null
//   findAnchor() -> element to place the widget inline in (optional; without
//                   one, or when it is not found, a floating dock is used)
//   getMeta()    -> { maxWin, badge } for the now-playing bar (optional)
//   cards()      -> [{ name, img, wrap }] game tiles for the "Already Bonused"
//                   and "Next Bonus" marks (optional)
//
// Everything reads the page's own visible markup. The selectors outside of
// Stake follow each site's current layout; when a site redesigns, getSlot
// returning null just hides the dock rather than adding a wrong game.

;(function () {
  "use strict"

  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim()
  }

  function textOf(selector, root) {
    const el = (root || document).querySelector(selector)
    return el ? clean(el.textContent) : ""
  }

  function firstText(selectors, root) {
    for (const sel of selectors) {
      const t = textOf(sel, root)
      if (t) return t
    }
    return ""
  }

  function normalize(name) {
    return (name || "").toLowerCase().replace(/[^a-z0-9]/g, "")
  }

  // The slot's own thumbnail is the only <img> on the page whose alt equals
  // the title — a plain "first image in the card" picks up provider logos.
  function imageByAlt(slotName) {
    const target = normalize(slotName)
    if (!target) return null
    for (const img of document.querySelectorAll("img[alt]")) {
      if (normalize(img.getAttribute("alt")) === target) {
        const src = img.currentSrc || img.getAttribute("src")
        if (src && !src.startsWith("data:")) return src
      }
    }
    return null
  }

  function stripBy(provider) {
    return clean(provider).replace(/^by\s+/i, "") || null
  }

  function slot(slotName, provider) {
    slotName = clean(slotName)
    if (!slotName) return null
    return { slotName, provider: stripBy(provider), imageUrl: imageByAlt(slotName) }
  }

  // Tiles described by a link selector, a name reader and the element that
  // should carry the badge.
  function cardsFrom(linkSelector, readName, pickWrap) {
    const out = []
    for (const card of document.querySelectorAll(linkSelector)) {
      const img = card.querySelector("img")
      if (!img) continue
      const name = clean(readName(card, img))
      if (!name) continue
      const wrap = pickWrap(card, img)
      if (wrap) out.push({ name, img, wrap })
    }
    return out
  }

  // --- Stake -------------------------------------------------------------------

  function stakeProvider() {
    const publisherH2 = document.querySelector('[data-testid="publisher-overview-card"] h2')
    if (publisherH2 && clean(publisherH2.textContent)) return clean(publisherH2.textContent)
    const providerLink = document.querySelector('.card-wrapper a[href*="/casino/group/"]')
    if (providerLink) {
      const inner = providerLink.querySelector("h2")
      const text = clean((inner || providerLink).textContent)
      if (text) return text
    }
    return null
  }

  // Reads the max-win multiplier and exclusivity badge out of the info row at
  // the bottom of the game, anchored on the Fun Play / Real Play buttons
  // (stable test ids) and walking up to the element that also holds the text.
  // Deliberately no page-wide fallback: a "Potential 25,000x" elsewhere on the
  // page (the overlay bar itself, in testing) would be reported as this game's.
  function stakeMetaScopes() {
    const scopes = []
    const button = document.querySelector('[data-testid="footer-fun-play-button"], [data-testid="footer-real-play-button"]')
    if (button) {
      let node = button.parentElement
      for (let i = 0; i < 6 && node && node !== document.body; i++) {
        const text = node.innerText || ""
        if (/Potential/i.test(text) || /Only on/i.test(text)) {
          scopes.push(node)
          break
        }
        node = node.parentElement
      }
    }
    const card = document.querySelector(".card-wrapper")
    if (card) scopes.push(card)
    return scopes
  }

  const stake = {
    id: "stake",
    name: "Stake",
    hosts: /(^|\.)(stake\.(com|bet|games|ac|pet|mba|jp|bz|ceo|krd)|staketr\.com)$/,
    getSlot() {
      const title = document.querySelector(".card-wrapper .title-wrap h1") || document.querySelector(".card-wrapper h1")
      if (!title) return null
      const slotName = clean(title.textContent)
      if (!slotName) return null
      let imageUrl = imageByAlt(slotName)
      if (!imageUrl) {
        // Stake's social-share tag is on every game page even if the
        // thumbnail markup changes shape.
        const og = document.querySelector('meta[property="og:image"]')
        if (og && og.getAttribute("content")) imageUrl = og.getAttribute("content")
      }
      return { slotName, provider: stakeProvider(), imageUrl }
    },
    findAnchor() {
      const fav = document.querySelector(".card-wrapper .favourite-wrap")
      return fav ? fav.parentElement : null
    },
    getMeta() {
      for (const scope of stakeMetaScopes()) {
        const text = (scope && scope.innerText) || ""
        if (!text) continue
        const potential = text.match(/Potential\s*([\d][\d.,]*\s*x)/i)
        // One capitalised word (plus optional .eu/.us): adjacent elements can
        // render without whitespace, and a looser pattern swallows the next
        // word whole ("Only on StakeThunder").
        const exclusive = text.match(/Only on ([A-Z][a-z]+(?:\.[a-z]{2,4})?)/)
        if (potential || exclusive) {
          return {
            maxWin: potential ? potential[1].replace(/\s+/g, "") : null,
            badge: exclusive ? ("Only on " + exclusive[1]).trim() : null,
          }
        }
      }
      return { maxWin: null, badge: null }
    },
    cards() {
      return cardsFrom(
        ".game-card-wrap",
        (card, img) => img.getAttribute("alt"),
        (card) => card.querySelector(".img-wrap"),
      )
    },
  }

  // --- Gamdom ------------------------------------------------------------------

  const gamdom = {
    id: "gamdom",
    name: "Gamdom",
    hosts: /(^|\.)gamdom\.com$/,
    getSlot() {
      // Gamdom's generic h1 is an SEO article heading, never the game name, so
      // only the game-specific test ids count.
      const name = firstText(['[data-testid="game-title"]', '[data-testid="game-page-mobile-game-name"]'])
      const provider = firstText([
        '[data-testid="game-provider"]',
        '[data-testid="game-page-mobile-game-provider-name"]',
        'a[href^="/casino/providers/"][class*="EllipsisTypography"]',
      ])
      return slot(name, provider)
    },
    cards() {
      return cardsFrom(
        'a[href^="/casino/"]',
        (card, img) => img.getAttribute("alt"),
        (card, img) =>
          img.closest('[class*="ItemBannerContainer"]') ||
          img.closest('[data-testid$="-banner-container"]') ||
          img.closest('[class*="styled__Image"]') ||
          img.parentElement,
      )
    },
  }

  // --- Roobet ------------------------------------------------------------------

  // The game header: the h1 that shares a container with a provider link that
  // has child elements (category tags are text-only links to the same path).
  function roobetHeader() {
    for (const h1 of document.querySelectorAll("h1")) {
      let node = h1.parentElement
      for (let i = 0; i < 6 && node && node !== document.body; i++) {
        const link = [...node.querySelectorAll('a[href*="/casino/provider/"]')].find((a) => a.children.length > 0)
        if (link) return { h1, link }
        node = node.parentElement
      }
    }
    return null
  }

  const roobet = {
    id: "roobet",
    name: "Roobet",
    hosts: /(^|\.)roobet\.com$/,
    getSlot() {
      if (!/\/casino\/game\//.test(location.pathname)) return null
      const header = roobetHeader()
      if (!header) return null
      return slot(header.h1.textContent, header.link.textContent)
    },
    cards() {
      return cardsFrom(
        'a[href*="/casino/game/"]',
        (card, img) => card.getAttribute("aria-label") || img.getAttribute("alt"),
        (card) => card,
      )
    },
  }

  // --- Shuffle -----------------------------------------------------------------

  const shuffle = {
    id: "shuffle",
    name: "Shuffle",
    hosts: /(^|\.)shuffle\.com$/,
    getSlot() {
      const name = textOf('h1[class*="gameAttributesName"]')
      if (name) return slot(name, textOf('[class*="gameAttributesProviderButton"] a span span'))
      // Mini-player (game popped out while browsing)
      return slot(textOf('a[class*="DraggableTitle_link"], a[class*="draggableTitle_link"]'), null)
    },
    cards() {
      return cardsFrom(
        '[class*="TallGameCard"][class*="root"], [class*="tallGameCard"][class*="root"], a[class*="GameCard_root"], a[class*="gameCard_root"]',
        (card, img) => img.getAttribute("alt"),
        (card, img) => img.closest('[class*="SkeletonPlaceholder"]') || img.parentElement,
      )
    },
  }

  // --- CSGO500 (500.casino) ----------------------------------------------------

  const csgo500 = {
    id: "csgo500",
    name: "CSGO500",
    hosts: /(^|\.)(500\.casino|csgo500\.com)$/,
    getSlot() {
      return slot(textOf(".bottom-bar .details h1.name"), textOf(".bottom-bar .provider a"))
    },
    cards() {
      return cardsFrom(
        'a.game[href*="/casino/game/"]',
        (card) => textOf(".game-info-title span", card),
        (card) => card.querySelector(".game-image-container") || card,
      )
    },
  }

  // --- Rainbet -----------------------------------------------------------------

  function rainbetGameBar() {
    const oldBar = document.querySelector('[class*="Slots_slot-game-bar"]')
    if (oldBar) return oldBar
    const content = document.querySelector('[class*="Slots_game-content"], [class*="__game-content"]')
    if (content) {
      for (const child of content.children) {
        if (child.querySelector("h2") && child.querySelector('a[href*="/casino/slots?provider="]')) return child
      }
    }
    return null
  }

  const rainbet = {
    id: "rainbet",
    name: "Rainbet",
    hosts: /(^|\.)rainbet\.com$/,
    getSlot() {
      const bar = rainbetGameBar()
      if (!bar) return null
      const providerLink = bar.querySelector('a[href*="/casino/slots?provider="]')
      const provider = providerLink
        ? clean((providerLink.querySelector("span") || providerLink).textContent)
        : textOf('[class*="Slots_game-link-content"] h3', bar)
      return slot(textOf("h2", bar), provider)
    },
  }

  // --- Thrill ------------------------------------------------------------------

  const thrill = {
    id: "thrill",
    name: "Thrill",
    hosts: /(^|\.)thrill\.com$/,
    getSlot() {
      const name = textOf(".typ-heading-medium.text-foreground-primary")
      if (!name) return null
      return slot(name, textOf('a.underline[href*="/casino/provider/"]'))
    },
  }

  // --- Duelbits ----------------------------------------------------------------

  const duelbits = {
    id: "duelbits",
    name: "Duelbits",
    hosts: /(^|\.)duelbits\.com$/,
    getSlot() {
      // The h1 is the game name (visually hidden, but always present) — on a
      // slot page only; elsewhere it is a section heading.
      if (!/\/slots\/[^/]+/.test(location.pathname)) return null
      return slot(firstText(["main h1", "h1"]), firstText(['a[href*="/slots/providers/"]', 'a[href*="provider"]']))
    },
  }

  // --- Razed -------------------------------------------------------------------

  const razed = {
    id: "razed",
    name: "Razed",
    hosts: /(^|\.)razed2?\.com$/,
    getSlot() {
      const title = document.querySelector('span[class*="MuiTypography-bodyXXL"]')
      if (!title) return null
      let provider = null
      const sub = title.parentElement && title.parentElement.querySelector('span[class*="MuiTypography-bodyXL"]:not([class*="bodyXXL"])')
      if (sub && !/^(Fun|Real) Play$/i.test(clean(sub.textContent))) provider = sub.textContent
      return slot(title.textContent, provider)
    },
  }

  // --- Winna -------------------------------------------------------------------

  const winna = {
    id: "winna",
    name: "Winna",
    hosts: /(^|\.)winna\.com$/,
    getSlot() {
      const h1 = textOf("h1.line-clamp-1")
      if (h1) return slot(h1, textOf('a[href*="/casino/provider/"] p'))
      const providerLink = document.querySelector('a[href*="/casino/provider/"]')
      if (!providerLink || !/\/game\//.test(location.pathname)) return null
      let node = providerLink.parentElement
      for (let i = 0; i < 6 && node && node !== document.body; i++) {
        const name = textOf('p.font-bold, p.font-semibold, p[class*="font-bold"]', node)
        if (name) return slot(name, textOf("p", providerLink))
        node = node.parentElement
      }
      return null
    },
  }

  // --- Acebet ------------------------------------------------------------------

  const acebet = {
    id: "acebet",
    name: "Acebet",
    hosts: /(^|\.)acebet\.co$/,
    getSlot() {
      const name = textOf("h1.inline.text-white")
      if (!name) return null
      return slot(name, textOf('a[href*="/crypto-casino/providers/"] div'))
    },
  }

  // --- Yeet --------------------------------------------------------------------

  const yeet = {
    id: "yeet",
    name: "Yeet",
    hosts: /(^|\.)yeet\.com$/,
    getSlot() {
      const name = textOf(".name-row h3")
      if (!name) return null
      let provider = null
      for (const link of document.querySelectorAll('a[href*="/casino/provider/"]')) {
        const m = clean(link.textContent).match(/More games from\s+(.+)/i)
        if (m) {
          provider = m[1]
          break
        }
      }
      return slot(name, provider)
    },
  }

  // --- Degen -------------------------------------------------------------------

  const degen = {
    id: "degen",
    name: "Degen",
    hosts: /(^|\.)degen\.com$/,
    getSlot() {
      const info = document.querySelector('[class*="_gameInfo_"]')
      if (!info) return null
      return slot(
        textOf("h1", info),
        firstText(['a[class*="_gameProvider_"]', 'a[href*="/casino/group/providers?provider="]'], info),
      )
    },
  }

  // --- Gamba --------------------------------------------------------------------
  // Checked against the live site (2026-10-03). Game pages are
  // /casino/games/<provider>/<game>; "gamba" as the provider is their own
  // originals (dice, crash, ...), which are not bonus games. The page title
  // reads "Sweet Bonanza 1000 by Pragmatic Play | Play Online at Gamba" and
  // the info block has the name in an h3 next to the box art. Lobby tiles
  // carry no name or alt text at all — only the link — so their name is the
  // URL slug, which normalizes to the same letters as the title.

  function gambaGamePath() {
    const m = location.pathname.match(/^\/casino\/games\/([^/]+)\/([^/]+)/)
    return m && m[1] !== "gamba" ? m : null
  }

  const gamba = {
    id: "gamba",
    name: "Gamba",
    hosts: /(^|\.)gamba\.com$/,
    getSlot() {
      if (!gambaGamePath()) return null
      const fromTitle = document.title.match(/^(.+?) by (.+?) \|/)
      const h3 = document.querySelector("h3.text-lg.font-bold")
      const name = (h3 && clean(h3.textContent)) || (fromTitle ? fromTitle[1] : "")
      // The title's provider first: provider links also appear in the
      // sidebar and footer, and the first one on the page is not always the
      // game's.
      const providerLink = document.querySelector(`a[href="/casino/provider/${gambaGamePath()[1]}"] span`)
      const provider = (fromTitle ? fromTitle[2] : null) || (providerLink && clean(providerLink.textContent))
      const result = slot(name, provider)
      if (result && !result.imageUrl && h3) {
        const art = h3.parentElement && h3.parentElement.parentElement && h3.parentElement.parentElement.querySelector("img")
        if (art) result.imageUrl = art.currentSrc || art.getAttribute("src") || null
      }
      return result
    },
    cards() {
      return cardsFrom(
        'a[href^="/casino/games/"]',
        (card) => {
          const m = (card.getAttribute("href") || "").match(/^\/casino\/games\/([^/]+)\/([^/?#]+)/)
          return m && m[1] !== "gamba" ? m[2].replace(/-/g, " ") : ""
        },
        (card, img) => img.parentElement,
      )
    },
  }

  self.THT_SITES = [stake, gamdom, roobet, shuffle, csgo500, gamba, rainbet, thrill, duelbits, razed, winna, acebet, yeet, degen]
  self.THT_normalize = normalize
})()

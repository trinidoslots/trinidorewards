// background.js — the only place that talks to the Trinidorewards API.
// Doing the fetch here (rather than in content.js) keeps the request inside
// an extension-privileged context, which is exempt from the page's CORS
// restrictions as long as the target origin is declared in host_permissions.
//
// It is also the relay for auto tracking: a bonus trigger is seen inside the
// game provider's iframe, but only the casino page around it knows the slot's
// name, so triggers are forwarded to the tab's top frame.

importScripts("config.js")

// Site and key come from Settings → Connection; config.js is the fallback.
async function getConnection() {
  const stored = await chrome.storage.local.get(["api_key", "base_url"])
  const allowed = CONFIG.SITE_OPTIONS.map((o) => o.url)
  const baseUrl = allowed.includes(stored.base_url) ? stored.base_url : CONFIG.BASE_URL
  let apiKey = (stored.api_key || "").trim()
  if (!apiKey && CONFIG.API_KEY && !/^PASTE_/.test(CONFIG.API_KEY)) apiKey = CONFIG.API_KEY
  return { baseUrl, apiKey }
}

async function api(path, init = {}) {
  const { baseUrl, apiKey } = await getConnection()
  if (!apiKey) return { ok: false, code: "no_key", data: { error: "Add your API key in Settings → Connection" } }
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${apiKey}` },
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

function failure(result) {
  if (result.code === "no_key") return { success: false, code: "no_key", error: result.data.error }
  if (result.status === 401) return { success: false, error: "API key rejected (401)" }
  if (result.status === 403) return { success: false, error: "Site refused the request (403)" }
  return { success: false, error: result.data.error || `Request failed (${result.status})` }
}

async function addBonus({ gameName, provider, betSize, isSuperBonus, badgeLabel, imageUrl }) {
  try {
    const result = await api("/api/extension/add-bonus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // game_name must stay the exact slot title — no quick-action label
        // gets appended to it, since the hunt-status matching (already
        // bonused overlay) compares this against the page's own slot name.
        game_name: gameName,
        provider,
        bet_size: betSize,
        is_super: !!isSuperBonus,
        badge_label: badgeLabel || null,
        image_url: imageUrl || null,
      }),
    })
    if (!result.ok) return failure(result)
    return { success: true, bonus: result.data.bonus }
  } catch (err) {
    return { success: false, error: "Network error — check your connection" }
  }
}

async function deleteBonus({ bonusId }) {
  try {
    const result = await api(`/api/extension/add-bonus?id=${encodeURIComponent(bonusId)}`, { method: "DELETE" })
    return result.ok ? { success: true } : failure(result)
  } catch (err) {
    return { success: false, error: "Network error — check your connection" }
  }
}

async function fetchHuntStatus() {
  try {
    const result = await api("/api/extension/add-bonus", { cache: "no-store" })
    if (!result.ok) return failure(result)

    const hunt = result.data.hunt || null
    const rawBonuses = (hunt && (hunt.bonuses || hunt.active_bonuses || hunt.bonus_list)) || []

    const bonuses = rawBonuses.map((b) => ({
      id: b.id ?? b.bonus_id ?? null,
      slotName: b.slot_name || b.game_name || b.slotName || "",
      provider: b.provider || null,
      betSize: b.bet_size ?? b.betSize ?? null,
      payout: b.payout ?? b.payout_amount ?? null,
      badgeLabel: b.badge_label || b.badgeLabel || null,
      isSuper: !!(b.is_super ?? b.isSuper ?? b.is_super_bonus),
      imageUrl: b.image_url || b.imageUrl || null,
      order: b.order ?? b.position ?? null,
      createdAt: b.created_at || null,
    }))

    return {
      success: true,
      huntId: hunt ? hunt.id : null,
      streamer: hunt ? hunt.streamer : null,
      title: hunt ? hunt.title : null,
      startingBalance: hunt ? hunt.starting_balance ?? null : null,
      isOpening: !!(hunt && (hunt.is_opening ?? hunt.status === "opening")),
      bonuses,
    }
  } catch (err) {
    return { success: false, error: "Network error — check your connection" }
  }
}

async function setNowPlaying({ slotName, provider, imageUrl, maxWin, badge }) {
  try {
    const result = await api("/api/extension/now-playing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slot_name: slotName,
        provider: provider || null,
        image_url: imageUrl || null,
        max_win: maxWin || null,
        badge: badge || null,
      }),
    })
    if (!result.ok) return failure(result)
    return { success: true, nowPlaying: result.data.now_playing }
  } catch (err) {
    return { success: false, error: "Network error — check your connection" }
  }
}

async function clearNowPlaying() {
  try {
    const result = await api("/api/extension/now-playing", { method: "DELETE" })
    return result.ok ? { success: true } : failure(result)
  } catch (err) {
    return { success: false, error: "Network error — check your connection" }
  }
}

// Provider iframe → the casino page in the same tab. frameId 0 is the top
// frame, where content.js runs; the game frame is nested somewhere below it.
function relayToTopFrame(sender, message) {
  const tabId = sender.tab && sender.tab.id
  if (tabId === undefined || tabId === null) return
  chrome.tabs.sendMessage(tabId, message, { frameId: 0 }).catch(() => {
    // No content script there: a casino the extension does not support, or
    // one switched off in Settings. Nothing to do.
  })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message?.action) {
    case "addBonus":
      addBonus(message.data).then(sendResponse)
      return true
    case "deleteBonus":
      deleteBonus(message.data).then(sendResponse)
      return true
    case "getHuntStatus":
      fetchHuntStatus().then(sendResponse)
      return true
    case "setNowPlaying":
      setNowPlaying(message.data).then(sendResponse)
      return true
    case "clearNowPlaying":
      clearNowPlaying().then(sendResponse)
      return true
    case "autoTrackBonus":
    case "autoTrackBet":
      relayToTopFrame(sender, { action: message.action, data: message.data })
      return false
    default:
      return false
  }
})

// Chrome only runs content scripts in pages loaded AFTER an install or
// update. A casino tab left open through one keeps the previous copy's widget
// on screen, cut off from the extension: buttons fail and now-playing
// auto-update goes quiet until the tab is reloaded. So the new copy is put
// into those tabs straight away; content.js clears out the stale one.
async function injectIntoOpenCasinoTabs() {
  const casino = chrome.runtime.getManifest().content_scripts[0]
  const tabs = await chrome.tabs.query({ url: casino.matches }).catch(() => [])
  for (const tab of tabs) {
    if (tab.discarded || tab.status === "unloaded") continue
    const target = { tabId: tab.id }
    try {
      await chrome.scripting.insertCSS({ target, files: casino.css })
      await chrome.scripting.executeScript({ target, files: casino.js })
    } catch (err) {
      // Tab closed, navigating, or showing an error page — it gets the
      // scripts normally on its next load.
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Trinidorewards Hunt Tracker] installed")
  injectIntoOpenCasinoTabs()
})

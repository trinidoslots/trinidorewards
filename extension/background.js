// background.js — the only place that talks to the Trinidorewards API.
// Doing the fetch here (rather than in content.js) keeps the request inside
// an extension-privileged context, which is exempt from the page's CORS
// restrictions as long as the target origin is declared in host_permissions.

importScripts("config.js")

async function addBonus({ gameName, provider, betSize, isSuperBonus, imageUrl }) {
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/api/extension/add-bonus`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.API_KEY}`,
      },
      body: JSON.stringify({
        game_name: gameName,
        provider,
        bet_size: betSize,
        is_super: !!isSuperBonus,
        image_url: imageUrl || null,
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return { success: false, error: data.error || `Request failed (${res.status})` }
    }

    return { success: true, bonus: data.bonus }
  } catch (err) {
    return { success: false, error: "Network error — check your connection" }
  }
}

async function deleteBonus({ bonusId }) {
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/api/extension/add-bonus?id=${encodeURIComponent(bonusId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${CONFIG.API_KEY}` },
    })
    const data = await res.json().catch(() => ({}))
    return { success: res.ok, error: data.error }
  } catch (err) {
    return { success: false, error: "Network error — check your connection" }
  }
}


async function setNowPlaying({ slotName, provider, imageUrl, maxWin, badge }) {
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/api/extension/now-playing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.API_KEY}`,
      },
      body: JSON.stringify({
        slot_name: slotName,
        provider: provider || null,
        image_url: imageUrl || null,
        max_win: maxWin || null,
        badge: badge || null,
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return { success: false, error: data.error || `Request failed (${res.status})` }
    }

    return { success: true, nowPlaying: data.now_playing }
  } catch (err) {
    return { success: false, error: "Network error — check your connection" }
  }
}

async function clearNowPlaying() {
  try {
    const res = await fetch(`${CONFIG.BASE_URL}/api/extension/now-playing`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${CONFIG.API_KEY}` },
    })
    const data = await res.json().catch(() => ({}))
    return { success: res.ok, error: data.error }
  } catch (err) {
    return { success: false, error: "Network error — check your connection" }
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action === "addBonus") {
    addBonus(message.data).then(sendResponse)
    return true
  }
  if (message?.action === "deleteBonus") {
    deleteBonus(message.data).then(sendResponse)
    return true
  }
  if (message?.action === "setNowPlaying") {
    setNowPlaying(message.data).then(sendResponse)
    return true
  }
  if (message?.action === "clearNowPlaying") {
    clearNowPlaying().then(sendResponse)
    return true
  }
  return false
})

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Trinidorewards Hunt Tracker] installed")
})

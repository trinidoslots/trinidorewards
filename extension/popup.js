// popup.js — two views: the active hunt (main) and settings. Every setting is
// a chrome.storage.local key; content.js and autotrack-bridge.js listen for
// changes, so a toggle here applies to open casino tabs without a reload.

// --- Setting definitions -----------------------------------------------------
// `def` is the value used when the key has never been written. The on-page
// widget options default to on because that is how the extension behaved
// before any of them could be switched off.

const GENERAL_SETTINGS = [
  { key: "setting_addBonus", title: 'Show "Add Bonus" button', desc: "The bet field and button on supported sites", def: true },
  { key: "setting_bonused", title: 'Show "Already Bonused"', desc: "Mark slots already in your hunt", def: true },
  { key: "setting_next", title: 'Show "Next Bonus" highlight', desc: "Highlight the next slot during opening", def: true },
  { key: "setting_toasts", title: "Confirmation pop-ups", desc: "Small notice on the page when a bonus is added", def: true },
]

const AUTOTRACK_EXTRA = [
  { key: "setting_syncBet", title: "Sync bet size from game", desc: "Fill the bet field with the bet you are spinning", def: true },
  { key: "setting_goBackOnBonus", title: "Go back on bonus", desc: "Auto-navigate back after a bonus is auto-added", def: false },
]

const OVERLAY_SETTINGS = [
  { key: "tht_now_playing_auto", title: "Auto-update now playing", desc: "Push whichever game you open to the stream bar", def: false },
  { key: "setting_nowPlayingMenu", title: "Show overlay actions in menu", desc: '"Set as now playing" and "Clear" in the widget menu', def: true },
]

const PROVIDER_SETTINGS = CONFIG.PROVIDERS.map((p) => ({
  key: `autotrack_${p.id}`,
  title: p.name,
  desc: p.examples,
  def: false,
}))

const CASINO_KEYS = CONFIG.CASINOS.map((c) => `site_${c.id}`)

const ALL_KEYS = [
  ...GENERAL_SETTINGS,
  ...AUTOTRACK_EXTRA,
  ...OVERLAY_SETTINGS,
  ...PROVIDER_SETTINGS,
].map((s) => s.key)

// --- Helpers -----------------------------------------------------------------

const $ = (id) => document.getElementById(id)

function formatMoney(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-"
  return "$" + Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])
}

function timeAgo(iso) {
  const t = Date.parse(iso)
  if (!t) return ""
  const s = Math.max(0, Math.round((Date.now() - t) / 1000))
  if (s < 60) return "just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, (r) => resolve(r || {})))
}

function storageSet(items) {
  return new Promise((resolve) => chrome.storage.local.set(items, resolve))
}

function isNum(v) {
  return v !== null && v !== undefined && v !== "" && !Number.isNaN(Number(v))
}

// --- Main view ---------------------------------------------------------------

const SUPPORTED_HINT = "Go to a supported site (Stake, Gamdom, Roobet, Shuffle, CSGO500, etc.) to add bonuses to this hunt."

function setStatus(kind, text) {
  const el = $("status")
  el.className = `status ${kind}`
  el.querySelector("span").textContent = text
}

function renderHunt(res) {
  const tag = $("hunt-tag")
  $("hunt-title").textContent = res.title || "Untitled hunt"
  $("hunt-sub").textContent = res.streamer ? `by ${res.streamer}` : ""

  const hasPayout = res.bonuses.some((b) => isNum(b.payout))
  tag.hidden = false
  tag.textContent = res.isOpening ? "Opening" : "Hunting"
  tag.className = res.isOpening ? "tag opening" : "tag"

  setStatus("active", "Active")
  $("status-hint").textContent = res.isOpening
    ? "The hunt is being opened. Auto tracking pauses until the next hunt."
    : SUPPORTED_HINT

  // Stats
  const bonuses = res.bonuses
  const totalBet = bonuses.reduce((sum, b) => sum + (isNum(b.betSize) ? Number(b.betSize) : 0), 0)
  const start = isNum(res.startingBalance) ? Number(res.startingBalance) : null
  $("stats").hidden = false
  $("stat-count").textContent = String(bonuses.length)
  $("stat-be").textContent = start && totalBet ? `${(start / totalBet).toFixed(2)}x` : "0.00x"
  $("stat-start").textContent = start !== null ? formatMoney(start) : "-"

  const opened = bonuses.filter((b) => isNum(b.payout))
  $("stats-open").hidden = !hasPayout
  if (hasPayout) {
    const totalWin = opened.reduce((sum, b) => sum + Number(b.payout), 0)
    const openedBet = opened.reduce((sum, b) => sum + (isNum(b.betSize) ? Number(b.betSize) : 0), 0)
    $("stat-opened").textContent = `${opened.length}/${bonuses.length}`
    $("stat-win").textContent = formatMoney(totalWin)
    $("stat-win").classList.toggle("good", start !== null && totalWin >= start)
    $("stat-avg").textContent = openedBet ? `${(totalWin / openedBet).toFixed(2)}x` : "-"
  }

  renderBonuses(bonuses, totalBet)
}

function renderBonuses(bonuses, totalBet) {
  const listEl = $("bonus-list")
  listEl.innerHTML = ""
  $("list-head").hidden = false
  $("list-total").textContent = totalBet ? `${formatMoney(totalBet)} total bet` : ""

  if (!bonuses.length) {
    listEl.innerHTML = '<div class="empty">No bonuses added yet</div>'
    return
  }

  // Newest first: the highest queue position was added last.
  const sorted = [...bonuses].sort((a, b) => (b.order ?? -1) - (a.order ?? -1))

  for (const bonus of sorted) {
    const item = document.createElement("div")
    item.className = "bonus"

    const name = bonus.slotName || "Unknown slot"
    const meta = [bonus.provider, timeAgo(bonus.createdAt)].filter(Boolean).map(escapeHtml).join(" · ")
    const thumb = bonus.imageUrl
      ? `<img class="thumb" src="${escapeHtml(bonus.imageUrl)}" alt="" />`
      : `<div class="thumb">${escapeHtml(name.charAt(0).toUpperCase())}</div>`

    let right = `<div class="bonus-bet">${formatMoney(bonus.betSize)}</div>`
    if (isNum(bonus.payout)) {
      const x = isNum(bonus.betSize) && Number(bonus.betSize) > 0 ? `${(Number(bonus.payout) / Number(bonus.betSize)).toFixed(1)}x` : ""
      right = `<div class="bonus-win">${formatMoney(bonus.payout)}</div><div class="bonus-x">${x}</div>`
    }

    item.innerHTML = `
      ${thumb}
      <div class="bonus-info">
        <div class="bonus-name">${escapeHtml(name)}</div>
        <div class="bonus-meta">${meta}</div>
      </div>
      <div class="bonus-right">${right}</div>
      ${bonus.id !== null && bonus.id !== undefined ? `<button class="del" type="button" title="Remove bonus" data-id="${escapeHtml(bonus.id)}">&times;</button>` : ""}
    `
    const img = item.querySelector("img.thumb")
    if (img) img.addEventListener("error", () => img.replaceWith(Object.assign(document.createElement("div"), { className: "thumb", textContent: name.charAt(0).toUpperCase() })))

    listEl.appendChild(item)
  }

  listEl.querySelectorAll(".del").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true
      await chrome.runtime.sendMessage({ action: "deleteBonus", data: { bonusId: btn.getAttribute("data-id") } })
      refreshStatus()
    })
  })
}

function renderEmpty(kind, title, statusText, hint) {
  $("hunt-title").textContent = title
  $("hunt-sub").textContent = ""
  $("hunt-tag").hidden = true
  setStatus(kind, statusText)
  $("status-hint").textContent = hint
  $("stats").hidden = true
  $("list-head").hidden = true
  $("bonus-list").innerHTML = ""
}

async function refreshStatus() {
  const btn = $("refresh")
  btn.classList.add("spinning")
  try {
    const res = await chrome.runtime.sendMessage({ action: "getHuntStatus" })
    if (!res || !res.success) {
      const missingKey = res && res.code === "no_key"
      renderEmpty(
        "error",
        missingKey ? "Not connected" : "Could not load the hunt",
        missingKey ? "No API key" : "Error",
        missingKey ? "Open Settings → Connection and paste your EXTENSION_API_KEY." : (res && res.error) || "Network error",
      )
      return
    }
    if (!res.huntId) {
      renderEmpty("inactive", "No active hunt", "Inactive", "Start a hunt on the site and it shows up here.")
      return
    }
    renderHunt(res)
  } catch (err) {
    renderEmpty("error", "Could not load the hunt", "Error", "Network error")
  } finally {
    btn.classList.remove("spinning")
  }
}

// --- Settings view -----------------------------------------------------------

function settingRow(def, value) {
  const row = document.createElement("label")
  row.className = "setting"
  row.innerHTML = `
    <div class="setting-text">
      <div class="setting-title">${escapeHtml(def.title)}</div>
      ${def.desc ? `<div class="setting-desc">${escapeHtml(def.desc)}</div>` : ""}
    </div>
    <span class="switch"><input type="checkbox" /><span></span></span>
  `
  const input = row.querySelector("input")
  input.checked = value
  input.addEventListener("change", () => storageSet({ [def.key]: input.checked }))
  return row
}

function renderToggleList(containerId, defs, stored) {
  const el = $(containerId)
  el.innerHTML = ""
  for (const def of defs) {
    const value = stored[def.key] === undefined ? def.def : stored[def.key] === true
    el.appendChild(settingRow(def, value))
  }
}

function renderCasinos(stored) {
  const grid = $("casino-grid")
  grid.innerHTML = ""
  for (const casino of CONFIG.CASINOS) {
    const key = `site_${casino.id}`
    const chip = document.createElement("button")
    chip.type = "button"
    let on = stored[key] !== false
    const paint = () => {
      chip.classList.toggle("on", on)
      chip.title = on ? `Tracker shown on ${casino.name}` : `Tracker hidden on ${casino.name}`
    }
    chip.className = "chip"
    chip.innerHTML = `<i></i><span>${escapeHtml(casino.name)}</span>`
    paint()
    chip.addEventListener("click", () => {
      on = !on
      paint()
      storageSet({ [key]: on })
    })
    grid.appendChild(chip)
  }
}

function renderLastAutoTrack(last) {
  const el = $("autotrack-last")
  if (!last || !last.slotName) {
    el.hidden = true
    return
  }
  const provider = CONFIG.PROVIDERS.find((p) => p.id === last.provider)
  el.hidden = false
  el.textContent = `Last auto-added: ${last.slotName} · ${formatMoney(last.bet)}${provider ? " · " + provider.name : ""} · ${timeAgo(new Date(last.at).toISOString())}`
}

async function renderConnection(stored) {
  const select = $("base-url")
  select.innerHTML = ""
  const current = stored.base_url || CONFIG.BASE_URL
  for (const opt of CONFIG.SITE_OPTIONS) {
    const o = document.createElement("option")
    o.value = opt.url
    o.textContent = opt.label
    if (opt.url === current) o.selected = true
    select.appendChild(o)
  }
  $("api-key").value = stored.api_key || ""
}

async function renderSettings() {
  const stored = await storageGet([...ALL_KEYS, ...CASINO_KEYS, "autotrack_last", "api_key", "base_url"])
  renderCasinos(stored)
  renderToggleList("provider-list", PROVIDER_SETTINGS, stored)
  renderToggleList("autotrack-extra", AUTOTRACK_EXTRA, stored)
  renderToggleList("general-list", GENERAL_SETTINGS, stored)
  renderToggleList("overlay-list", OVERLAY_SETTINGS, stored)
  renderLastAutoTrack(stored.autotrack_last)
  renderConnection(stored)
}

function setConnStatus(kind, text) {
  const el = $("conn-status")
  el.className = `conn-status ${kind || ""}`
  el.textContent = text || ""
}

async function saveConnection() {
  const btn = $("save-conn")
  btn.disabled = true
  setConnStatus("", "Checking…")
  await storageSet({ api_key: $("api-key").value.trim(), base_url: $("base-url").value })
  const res = await chrome.runtime.sendMessage({ action: "getHuntStatus" }).catch(() => null)
  btn.disabled = false
  if (res && res.success) {
    setConnStatus("ok", res.huntId ? "Connected · hunt active" : "Connected · no active hunt")
    refreshStatus()
  } else {
    setConnStatus("err", (res && res.error) || "Could not connect")
  }
}

function showView(name) {
  const settings = name === "settings"
  $("view-main").hidden = settings
  $("view-settings").hidden = !settings
  $("open-settings").classList.toggle("active", settings)
  $("refresh").hidden = settings
  if (settings) renderSettings()
  else refreshStatus()
  window.scrollTo(0, 0)
}

// --- Wiring ------------------------------------------------------------------

$("refresh").addEventListener("click", refreshStatus)
$("open-settings").addEventListener("click", () => showView($("view-settings").hidden ? "settings" : "main"))
$("close-settings").addEventListener("click", () => showView("main"))
$("save-conn").addEventListener("click", saveConnection)
$("toggle-key").addEventListener("click", () => {
  const input = $("api-key")
  const show = input.type === "password"
  input.type = show ? "text" : "password"
  $("toggle-key").textContent = show ? "Hide" : "Show"
})
$("version").textContent = `v${chrome.runtime.getManifest().version} · trinidorewards.com`

// The in-page menu can flip auto-update too; keep the open settings in step.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || $("view-settings").hidden) return
  if (changes.tht_now_playing_auto || changes.autotrack_last) renderSettings()
})

showView("main")

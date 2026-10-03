// content.js — the on-page tracker for every supported casino.
//
// On Stake it injects a "+ Add Bonus" split button into the game info row
// (next to the favourite/heart icon), where Stake's own native widgets live.
// Everywhere else — and on Stake if that row cannot be found — the same
// controls sit in a small dock at the bottom-right of game pages.
//
// The page is only ever read through the casino's adapter in sites.js.
// Settings come from chrome.storage.local and are written by the popup.

;(function () {
  "use strict"

  const SITE = (self.THT_SITES || []).find((s) => s.hosts.test(location.hostname))
  if (!SITE) return
  const normalizeSlotName = self.THT_normalize

  let widgetRoot = null
  let widgetMode = null // "inline" | "float"
  let currentAnchor = null
  let betInputRef = null
  let mainBtnRef = null

  // --- Safe chrome.* wrappers ------------------------------------------
  // Once this content script's extension context is invalidated (the
  // extension gets reloaded/updated while a casino tab stays open),
  // chrome.runtime/chrome.storage calls throw synchronously — not just via
  // chrome.runtime.lastError — so every call site is routed through these
  // helpers. Without them the console fills with uncaught "Extension context
  // invalidated" errors (the poll loop alone would throw one every 5 seconds)
  // until the tab is refreshed.

  function isExtensionValid() {
    try {
      return !!(chrome.runtime && chrome.runtime.id)
    } catch (err) {
      return false
    }
  }

  function safeSendMessage(message, callback) {
    if (!isExtensionValid()) {
      if (callback) callback(null)
      return
    }
    try {
      chrome.runtime.sendMessage(message, (response) => {
        // The context can become invalidated between firing the call and
        // this callback running, so reading lastError can itself throw.
        try {
          if (chrome.runtime.lastError) {
            if (callback) callback(null)
            return
          }
          if (callback) callback(response)
        } catch (err) {
          if (callback) callback(null)
        }
      })
    } catch (err) {
      if (callback) callback(null)
    }
  }

  function safeStorageGet(keys, callback) {
    if (!isExtensionValid()) return
    try {
      chrome.storage.local.get(keys, (result) => {
        try {
          if (chrome.runtime.lastError) return
          callback(result)
        } catch (err) {
          // Context invalidated between the call and this callback firing.
        }
      })
    } catch (err) {
      // Context invalidated mid-call — nothing more to do.
    }
  }

  function safeStorageSet(items) {
    if (!isExtensionValid()) return
    try {
      chrome.storage.local.set(items)
    } catch (err) {
      // Context invalidated mid-call — nothing more to do.
    }
  }

  // --- Settings --------------------------------------------------------------
  // storage key -> [settings field, default]. Defaults match how the tracker
  // behaved before these could be switched off.

  const SETTING_KEYS = {
    ["site_" + SITE.id]: ["siteEnabled", true],
    setting_addBonus: ["addBonus", true],
    setting_bonused: ["bonused", true],
    setting_next: ["next", true],
    setting_toasts: ["toasts", true],
    setting_syncBet: ["syncBet", true],
    setting_goBackOnBonus: ["goBackOnBonus", false],
    setting_nowPlayingMenu: ["nowPlayingMenu", true],
  }

  function readSetting(key, value) {
    const def = SETTING_KEYS[key][1]
    return value === undefined ? def : value === true
  }

  // --- Shared state: which bonuses are already in the current hunt --------
  // Populated by polling background.js and mirrored into
  // chrome.storage.local, so multiple tabs stay in sync without each one
  // polling the API separately.
  const BonusTrackerState = {
    activeBonuses: [],
    isOpening: false,
    huntId: null,
    settings: Object.fromEntries(Object.values(SETTING_KEYS).map(([field, def]) => [field, def])),
    listeners: [],

    init() {
      if (!isExtensionValid()) return

      const keys = ["currentHuntBonuses", "currentHuntIsOpening", "currentHuntId", ...Object.keys(SETTING_KEYS)]
      safeStorageGet(keys, (result) => this.updateFromStorage(result))

      try {
        chrome.storage.onChanged.addListener((changes, namespace) => {
          if (namespace !== "local") return
          const updates = {}
          for (const key of keys) {
            if (changes[key]) updates[key] = changes[key].newValue
          }
          if (Object.keys(updates).length > 0) this.updateFromStorage(updates)
        })
      } catch (err) {
        // Context invalidated — no point polling further either.
        return
      }

      let pollIntervalId = null
      const poll = () => {
        if (!isExtensionValid()) {
          if (pollIntervalId) clearInterval(pollIntervalId)
          return
        }
        if (!this.settings.siteEnabled) return
        safeSendMessage({ action: "getHuntStatus" }, (response) => {
          if (!response || !response.success) return
          safeStorageSet({
            currentHuntBonuses: response.bonuses || [],
            currentHuntIsOpening: !!response.isOpening,
            currentHuntId: response.huntId || null,
          })
        })
      }
      poll()
      pollIntervalId = setInterval(poll, 5000)
    },

    updateFromStorage(data) {
      let changed = false
      if (data.currentHuntBonuses !== undefined) {
        this.activeBonuses = data.currentHuntBonuses || []
        changed = true
      }
      if (data.currentHuntIsOpening !== undefined) {
        this.isOpening = !!data.currentHuntIsOpening
        changed = true
      }
      if (data.currentHuntId !== undefined) {
        this.huntId = data.currentHuntId || null
        changed = true
      }
      for (const key of Object.keys(SETTING_KEYS)) {
        if (key in data) {
          this.settings[SETTING_KEYS[key][0]] = readSetting(key, data[key])
          changed = true
        }
      }
      if (changed) this.notifyListeners()
    },

    subscribe(callback) {
      this.listeners.push(callback)
      callback()
    },

    notifyListeners() {
      this.listeners.forEach((cb) => cb())
    },
  }

  function getSlot() {
    try {
      return SITE.getSlot() || null
    } catch (err) {
      return null
    }
  }

  function getMeta() {
    try {
      return (SITE.getMeta && SITE.getMeta()) || { maxWin: null, badge: null }
    } catch (err) {
      return { maxWin: null, badge: null }
    }
  }

  // --- Already-bonused / next-to-open marks ---------------------------------
  // Greys out + badges any game tile already in the active hunt, and
  // highlights whichever unopened bonus is next in line during opening.

  function clearMarks(img, wrap) {
    img.classList.remove("tht-next-opening", "tht-bonused-img")
    const nextBadge = wrap.querySelector(":scope > .tht-next-badge")
    if (nextBadge) nextBadge.remove()
    const badge = wrap.querySelector(":scope > .tht-bonused-badge")
    if (badge) badge.remove()
  }

  function markBonusedSlots() {
    if (!isExtensionValid() || !SITE.cards) return

    let cards
    try {
      cards = SITE.cards()
    } catch (err) {
      return
    }
    if (!cards.length) return

    const { activeBonuses, isOpening, settings } = BonusTrackerState
    const enabled = settings.siteEnabled
    const hasPayout = activeBonuses.some((b) => b.payout !== null && b.payout !== undefined)

    let nextBonusToOpen = null
    if (isOpening) {
      const sorted = [...activeBonuses].sort((a, b) => (a.order || 0) - (b.order || 0))
      nextBonusToOpen = sorted.find((b) => b.payout === null || b.payout === undefined)
    }
    const nextName = nextBonusToOpen ? normalizeSlotName(nextBonusToOpen.slotName) : ""

    for (const { name, img, wrap } of cards) {
      const normalized = normalizeSlotName(name)
      if (!enabled || !normalized) {
        clearMarks(img, wrap)
        continue
      }

      const bonus = activeBonuses.find(
        (b) => b.slotName && normalizeSlotName(b.slotName) === normalized && (b.payout === null || b.payout === undefined),
      )
      const isNext = settings.next && nextName && nextName === normalized
      const isBonused = settings.bonused && bonus && !(isOpening && hasPayout)

      if ((isNext || isBonused) && getComputedStyle(wrap).position === "static") {
        wrap.style.position = "relative"
      }

      // Next-to-open highlight
      if (isNext) {
        img.classList.add("tht-next-opening")
        wrap.style.overflow = "visible"
        if (!wrap.querySelector(":scope > .tht-next-badge")) {
          const nextBadge = document.createElement("div")
          nextBadge.className = "tht-next-badge"
          nextBadge.textContent = "Next Bonus"
          wrap.appendChild(nextBadge)
        }
      } else {
        img.classList.remove("tht-next-opening")
        const nextBadge = wrap.querySelector(":scope > .tht-next-badge")
        if (nextBadge) nextBadge.remove()
      }

      // Already-bonused overlay
      if (isBonused) {
        img.classList.add("tht-bonused-img")
        let badge = wrap.querySelector(":scope > .tht-bonused-badge")
        if (!badge) {
          badge = document.createElement("div")
          badge.className = "tht-bonused-badge"
          wrap.appendChild(badge)
        }
        const badgeText = bonus.badgeLabel || "Already Bonused"
        if (badge.textContent !== badgeText) badge.textContent = badgeText
      } else {
        img.classList.remove("tht-bonused-img")
        const badge = wrap.querySelector(":scope > .tht-bonused-badge")
        if (badge) badge.remove()
      }
    }
  }

  // --- Toast -------------------------------------------------------------------

  let toastEl = null
  let toastTimer = null

  function toast(message, kind) {
    if (!BonusTrackerState.settings.toasts && kind !== "error") return
    if (!toastEl || !document.body.contains(toastEl)) {
      toastEl = document.createElement("div")
      toastEl.id = "tht-toast"
      document.body.appendChild(toastEl)
    }
    toastEl.className = `tht-toast-${kind || "info"}`
    toastEl.textContent = message
    void toastEl.offsetWidth
    toastEl.classList.add("tht-toast-show")
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => toastEl && toastEl.classList.remove("tht-toast-show"), 3200)
  }

  // --- Panel -----------------------------------------------------------

  function setStatus(el, message, kind) {
    el.textContent = message
    el.className = `tht-status ${kind}`
    if (kind !== "pending") {
      setTimeout(() => {
        el.textContent = ""
        el.className = "tht-status"
      }, 2500)
    }
  }

  function getPanelEls(panel) {
    return {
      hint: panel.querySelector('[data-role="hint"]'),
      slotInput: panel.querySelector('[data-role="slot-name"]'),
      status: panel.querySelector('[data-role="status"]'),
      customFields: panel.querySelector('[data-role="custom-fields"]'),
    }
  }

  function refreshPanelHint(panel, betInput) {
    const els = getPanelEls(panel)
    const detected = getSlot()
    els.hint.textContent = detected
      ? `${detected.slotName}${detected.provider ? " · " + detected.provider : ""}`
      : "Could not detect a game on this page"

    if (els.slotInput && (!els.slotInput.value || els.slotInput.dataset.autoFilled === "true")) {
      els.slotInput.value = detected ? detected.slotName : ""
      els.slotInput.dataset.autoFilled = "true"
    }

    safeStorageGet(["tht_last_bet_size"], (result) => {
      if (result.tht_last_bet_size && !betInput.value) betInput.value = result.tht_last_bet_size
    })

    // Now-playing items follow the "Show overlay actions in menu" setting.
    const showOverlay = BonusTrackerState.settings.nowPlayingMenu
    panel.querySelectorAll('[data-group="overlay"]').forEach((el) => {
      el.style.display = showOverlay ? "" : "none"
    })
  }

  function setInlineStatus(betInput, message, kind) {
    const box = betInput.parentElement || betInput
    box.classList.remove("tht-bet-pill-error", "tht-bet-pill-success")
    if (kind === "error") box.classList.add("tht-bet-pill-error")
    if (kind === "success") box.classList.add("tht-bet-pill-success")
    betInput.title = message || ""
    if (kind !== "pending") {
      setTimeout(() => {
        box.classList.remove("tht-bet-pill-error", "tht-bet-pill-success")
        betInput.title = ""
      }, 2500)
    }
  }

  // Brief scale + green-ring pulse on the main button, confirming the bonus
  // was added.
  function flashSuccess(el) {
    if (!el) return
    el.classList.remove("tht-success-flash")
    void el.offsetWidth // force reflow so the animation restarts
    el.classList.add("tht-success-flash")
    el.addEventListener("animationend", () => el.classList.remove("tht-success-flash"), { once: true })
  }

  function handleAdd(panel, betInput, { badgeLabel, isSuperBonus, useCustomName, statusEl, flashEl } = {}) {
    const els = getPanelEls(panel)
    const betSize = Number.parseFloat(betInput.value)
    const report = (msg, kind) => {
      if (statusEl) setStatus(statusEl, msg, kind)
      else setInlineStatus(betInput, msg, kind)
    }

    if (!betSize || Number.isNaN(betSize) || betSize <= 0) {
      report("Enter a valid bet size", "error")
      return
    }

    const detected = getSlot()
    const gameName = useCustomName ? els.slotInput.value.trim() : detected && detected.slotName

    if (!gameName) {
      report("Could not detect the game name", "error")
      return
    }

    safeStorageSet({ tht_last_bet_size: betSize })
    report("Adding…", "pending")

    safeSendMessage(
      {
        action: "addBonus",
        data: {
          // The name sent here must exactly match the slot's real title —
          // it's later matched against each game tile to draw the "already
          // bonused" overlay. Any quick-action label (Super Bonus, 5
          // Scatters) is sent separately instead of being appended to it.
          gameName,
          provider: detected ? detected.provider : null,
          betSize,
          isSuperBonus: !!isSuperBonus,
          badgeLabel: badgeLabel || null,
          imageUrl: (detected && detected.imageUrl) || null,
        },
      },
      (response) => {
        if (!response) {
          report("Reload the page", "error")
          return
        }
        if (response.success) {
          report("Added!", "success")
          flashSuccess(flashEl)
          toast(`Added ${gameName} · $${betSize.toFixed(2)}`, "success")
          panel.classList.add("tht-hidden")
          if (els.customFields) els.customFields.classList.add("tht-hidden")
        } else {
          report(response.error || "Failed to add", "error")
        }
      },
    )
  }

  // --- Now playing ---------------------------------------------------------
  // Sets the slot shown by the /obs/now-playing bar to whatever game this page
  // is. Separate from adding a bonus on purpose: the game you are about to play
  // and the game you are logging into the hunt are not always the same one.

  function pushNowPlaying(detected, meta, onDone) {
    safeSendMessage(
      {
        action: "setNowPlaying",
        data: {
          slotName: detected.slotName,
          provider: detected.provider,
          imageUrl: detected.imageUrl,
          maxWin: meta.maxWin,
          badge: meta.badge,
        },
      },
      onDone,
    )
  }

  function handleNowPlaying(statusEl, { clear } = {}) {
    if (clear) {
      setStatus(statusEl, "Clearing…", "pending")
      safeSendMessage({ action: "clearNowPlaying" }, (response) => {
        if (response && response.success) setStatus(statusEl, "Cleared", "success")
        else setStatus(statusEl, (response && response.error) || "Failed to clear", "error")
      })
      return
    }

    const detected = getSlot()
    if (!detected) {
      setStatus(statusEl, "Could not detect the game", "error")
      return
    }

    setStatus(statusEl, "Setting…", "pending")
    pushNowPlaying(detected, getMeta(), (response) => {
      if (response && response.success) setStatus(statusEl, "On the overlay", "success")
      else setStatus(statusEl, (response && response.error) || "Failed to set", "error")
    })
  }

  // --- Auto-sync -----------------------------------------------------------
  // Follows the page: when the game under you changes, the overlay's bar
  // changes with it, with no click at all.
  //
  // Off until switched on (widget menu or Settings), and the state is
  // remembered. On by default would mean that installing this, or idly
  // opening a game page to look at it, silently changes what is on stream.

  const AUTO_KEY = "tht_now_playing_auto"

  // How long the same game has to stay on screen before it is pushed, so that
  // clicking through four games does not put four of them on stream.
  const AUTO_SETTLE_MS = 2500

  let autoEnabled = false
  let autoMenuEl = null
  let lastPushedSlot = ""
  let pendingSlot = ""
  let settleTimer = null

  safeStorageGet([AUTO_KEY], (result) => {
    autoEnabled = !!result[AUTO_KEY]
    paintAutoMenu()
  })

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[AUTO_KEY]) return
      const on = !!changes[AUTO_KEY].newValue
      if (on === autoEnabled) return
      autoEnabled = on
      paintAutoMenu()
      if (on) {
        lastPushedSlot = ""
        checkAutoSync()
      }
    })
  } catch (err) {
    // Context invalidated.
  }

  function paintAutoMenu() {
    if (autoMenuEl) {
      autoMenuEl.textContent = "Auto-update: " + (autoEnabled ? "on" : "off")
      autoMenuEl.classList.toggle("tht-muted", !autoEnabled)
    }
  }

  function setAutoEnabled(on, statusEl) {
    autoEnabled = !!on
    safeStorageSet({ [AUTO_KEY]: autoEnabled })
    paintAutoMenu()

    if (autoEnabled) {
      // Push straight away: you turn this on because the game in front of you
      // is the one you are playing.
      lastPushedSlot = ""
      checkAutoSync(statusEl)
      if (statusEl) setStatus(statusEl, "Auto-update on", "success")
    } else if (statusEl) {
      setStatus(statusEl, "Auto-update off", "success")
    }
  }

  function checkAutoSync(statusEl) {
    if (!autoEnabled || !BonusTrackerState.settings.siteEnabled) return

    const detected = getSlot()
    const slotName = detected ? detected.slotName : ""
    // No game on this page (a lobby, search results) is not a change — it
    // leaves whatever is on stream alone rather than clearing it.
    if (!slotName || slotName === lastPushedSlot || slotName === pendingSlot) return

    pendingSlot = slotName
    clearTimeout(settleTimer)
    settleTimer = setTimeout(() => {
      const settled = getSlot()
      if (!autoEnabled || !settled || settled.slotName !== slotName) {
        pendingSlot = ""
        return
      }
      pushNowPlaying(settled, getMeta(), (response) => {
        pendingSlot = ""
        if (response && response.success) {
          lastPushedSlot = slotName
          if (statusEl) setStatus(statusEl, "On the overlay", "success")
        }
      })
    }, AUTO_SETTLE_MS)
  }

  // --- Auto tracking -----------------------------------------------------------
  // autotrack-injected.js runs inside the game provider's iframe and sees each
  // spin's server response. A bonus trigger reaches this frame through
  // autotrack-bridge.js → background.js, already filtered by the per-provider
  // toggle; this side decides whether the hunt can take it and names the slot.

  const PROVIDER_NAMES = Object.fromEntries((self.CONFIG ? CONFIG.PROVIDERS : []).map((p) => [p.id, p.name]))

  // One bonus per trigger: a retrigger, or a second response for the same
  // round slipping past the frame's own de-duplication, must not add twice.
  const AUTO_DEDUPE_MS = 8000
  let lastAutoAddAt = 0

  function onAutoBet(data) {
    if (!BonusTrackerState.settings.siteEnabled || !BonusTrackerState.settings.syncBet) return
    const bet = Number(data && data.bet)
    if (!bet || bet <= 0) return
    const value = String(Math.round(bet * 100) / 100)
    if (betInputRef && document.activeElement !== betInputRef) betInputRef.value = value
    safeStorageSet({ tht_last_bet_size: Number(value) })
  }

  function onAutoBonus(data, attempt) {
    const state = BonusTrackerState
    if (!state.settings.siteEnabled) return

    const now = Date.now()
    if (!attempt && now - lastAutoAddAt < AUTO_DEDUPE_MS) return

    if (!state.huntId) {
      toast("Bonus detected — no active hunt to add it to", "error")
      return
    }
    // Only while hunting: once opening has started (or anything has a
    // payout) new bonuses belong to the next hunt, not this one.
    if (state.isOpening || state.activeBonuses.some((b) => b.payout !== null && b.payout !== undefined)) {
      toast("Bonus detected — hunt is being opened, not added", "error")
      return
    }

    const detected = getSlot()
    if (!detected) {
      // The slot title can render after the game frame is already spinning.
      if (!attempt) setTimeout(() => onAutoBonus(data, 1), 1200)
      else toast("Bonus detected — could not read the game name", "error")
      return
    }

    let betSize = Number(data && data.bet)
    if (!betSize || betSize <= 0) betSize = Number.parseFloat(betInputRef && betInputRef.value)
    if (!betSize || betSize <= 0) {
      toast(`Bonus detected on ${detected.slotName} — bet size unknown, add it manually`, "error")
      return
    }
    betSize = Math.round(betSize * 100) / 100

    lastAutoAddAt = now
    safeSendMessage(
      {
        action: "addBonus",
        data: {
          gameName: detected.slotName,
          provider: detected.provider || PROVIDER_NAMES[data.provider] || null,
          betSize,
          isSuperBonus: false,
          badgeLabel: null,
          imageUrl: detected.imageUrl || null,
        },
      },
      (response) => {
        if (!response || !response.success) {
          lastAutoAddAt = 0
          toast(`Auto-add failed: ${(response && response.error) || "reload the page"}`, "error")
          return
        }
        flashSuccess(mainBtnRef)
        toast(`Auto-added ${detected.slotName} · $${betSize.toFixed(2)}`, "success")
        safeStorageSet({
          tht_last_bet_size: betSize,
          autotrack_last: { slotName: detected.slotName, bet: betSize, provider: data.provider, at: Date.now() },
        })
        if (state.settings.goBackOnBonus) {
          // Long enough to see the confirmation; the bonus itself stays
          // pending in the game and is opened later with the hunt.
          setTimeout(() => history.back(), 3500)
        }
      },
    )
  }

  try {
    chrome.runtime.onMessage.addListener((message) => {
      if (message && message.action === "autoTrackBonus") onAutoBonus(message.data || {}, 0)
      if (message && message.action === "autoTrackBet") onAutoBet(message.data || {})
      return false
    })
  } catch (err) {
    // Context invalidated.
  }

  // --- Widget ------------------------------------------------------------

  const BRAND_SVG =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="0.5" y="0.5" width="63" height="63" rx="14" fill="#121216" stroke="rgba(255,255,255,0.14)"/><rect x="14" y="18" width="26" height="7" rx="1.5" fill="#fff"/><rect x="23.5" y="18" width="7" height="28" rx="1.5" fill="#fff"/><circle cx="45" cy="21.5" r="4.5" fill="#5B8DEF"/></svg>'

  function buildPanel() {
    const panel = document.createElement("div")
    panel.className = "tht-panel tht-hidden"
    panel.innerHTML = `
      <div class="tht-hint" data-role="hint"></div>
      <div class="tht-menu-item" data-role="quick-super">Add Super Bonus</div>
      <div class="tht-menu-item" data-role="quick-scatters">Add 5 Scatters</div>
      <div class="tht-divider" data-group="overlay"></div>
      <div class="tht-menu-item" data-group="overlay" data-role="now-playing">Set as now playing</div>
      <div class="tht-menu-item tht-muted" data-group="overlay" data-role="now-playing-clear">Clear now playing</div>
      <div class="tht-menu-item tht-muted" data-group="overlay" data-role="now-playing-auto">Auto-update: off</div>
      <div class="tht-divider"></div>
      <div class="tht-menu-item tht-muted" data-role="toggle-custom">+ Custom bonus…</div>
      <div class="tht-custom-fields tht-hidden" data-role="custom-fields">
        <input class="tht-input" data-role="slot-name" type="text" placeholder="Slot name" />
        <div class="tht-actions">
          <button type="button" data-role="cancel">Cancel</button>
          <button type="button" data-role="confirm">Add</button>
        </div>
      </div>
      <div class="tht-status" data-role="status"></div>
    `
    return panel
  }

  function buildWidget(mode) {
    const root = document.createElement("div")
    root.id = "tht-widget-root"
    root.className = mode === "float" ? "tht-float" : "tht-inline"

    // Stake's game-info row itself is clickable (collapses/expands the card),
    // so every interaction inside the widget is stopped once, at the root.
    // Without this, clicking a menu item bubbles to the page's own handler.
    root.addEventListener("click", (e) => e.stopPropagation())
    root.addEventListener("mousedown", (e) => e.stopPropagation())

    // Bet size field, styled like Stake's native bet-amount pill.
    const betWrap = document.createElement("div")
    betWrap.className = "tht-bet-wrap"

    const betCurrency = document.createElement("span")
    betCurrency.className = "tht-bet-currency"
    betCurrency.textContent = "$"

    const betInput = document.createElement("input")
    betInput.type = "number"
    betInput.step = "0.01"
    betInput.min = "0"
    betInput.className = "tht-bet-pill"
    betInput.placeholder = "Bet size"
    betWrap.append(betCurrency, betInput)

    // Restore the last-used bet size immediately, so it survives a page
    // refresh/navigation.
    safeStorageGet(["tht_last_bet_size"], (result) => {
      if (result.tht_last_bet_size && !betInput.value) betInput.value = result.tht_last_bet_size
    })

    const btnWrap = document.createElement("div")
    btnWrap.className = "tht-split-btn"

    const mainBtn = document.createElement("button")
    mainBtn.type = "button"
    mainBtn.className = "tht-main-btn"
    mainBtn.textContent = "+ Add Bonus"

    const arrowBtn = document.createElement("button")
    arrowBtn.type = "button"
    arrowBtn.className = "tht-arrow-btn"
    arrowBtn.textContent = "▾"
    btnWrap.append(mainBtn, arrowBtn)

    const panel = buildPanel()

    if (mode === "float") {
      // Dock: brand button (collapses it) + game name + the same controls.
      const brand = document.createElement("button")
      brand.type = "button"
      brand.className = "tht-dock-brand"
      brand.title = "Hunt Tracker — click to collapse"
      brand.innerHTML = BRAND_SVG

      const body = document.createElement("div")
      body.className = "tht-dock-body"
      const label = document.createElement("div")
      label.className = "tht-dock-slot"
      label.innerHTML = '<span data-role="dock-name"></span><small data-role="dock-provider"></small>'
      body.append(label, betWrap, btnWrap)
      root.append(brand, body, panel)

      safeStorageGet(["tht_dock_collapsed"], (r) => root.classList.toggle("tht-collapsed", !!r.tht_dock_collapsed))
      brand.addEventListener("click", () => {
        const collapsed = !root.classList.contains("tht-collapsed")
        root.classList.toggle("tht-collapsed", collapsed)
        brand.title = collapsed ? "Hunt Tracker — click to expand" : "Hunt Tracker — click to collapse"
        if (collapsed) panel.classList.add("tht-hidden")
        safeStorageSet({ tht_dock_collapsed: collapsed })
      })
    } else {
      root.append(betWrap, btnWrap, panel)
    }

    betInput.addEventListener("change", () => {
      safeStorageSet({ tht_last_bet_size: Number.parseFloat(betInput.value) || 0 })
    })
    // Keep the casino's own hotkeys (space to spin, etc.) out of the field.
    betInput.addEventListener("keydown", (e) => {
      e.stopPropagation()
      if (e.key === "Enter") handleAdd(panel, betInput, { flashEl: mainBtn })
    })

    const statusEl = panel.querySelector('[data-role="status"]')

    panel.querySelector('[data-role="quick-super"]').addEventListener("click", () => {
      handleAdd(panel, betInput, { badgeLabel: "Super Bonus", isSuperBonus: true, statusEl, flashEl: mainBtn })
    })
    panel.querySelector('[data-role="quick-scatters"]').addEventListener("click", () => {
      handleAdd(panel, betInput, { badgeLabel: "5 Scatters", isSuperBonus: true, statusEl, flashEl: mainBtn })
    })
    panel.querySelector('[data-role="now-playing"]').addEventListener("click", () => handleNowPlaying(statusEl))
    panel.querySelector('[data-role="now-playing-clear"]').addEventListener("click", () => {
      handleNowPlaying(statusEl, { clear: true })
    })
    autoMenuEl = panel.querySelector('[data-role="now-playing-auto"]')
    paintAutoMenu()
    autoMenuEl.addEventListener("click", () => setAutoEnabled(!autoEnabled, statusEl))
    panel.querySelector('[data-role="toggle-custom"]').addEventListener("click", () => {
      panel.querySelector('[data-role="custom-fields"]').classList.toggle("tht-hidden")
    })
    panel.querySelector('[data-role="cancel"]').addEventListener("click", () => panel.classList.add("tht-hidden"))
    panel.querySelector('[data-role="confirm"]').addEventListener("click", () => {
      handleAdd(panel, betInput, { useCustomName: true, statusEl, flashEl: mainBtn })
    })
    const slotInput = panel.querySelector('[data-role="slot-name"]')
    slotInput.addEventListener("input", (e) => {
      e.target.dataset.autoFilled = "false"
    })
    slotInput.addEventListener("keydown", (e) => e.stopPropagation())

    // Main button adds the detected bonus immediately; the arrow is the only
    // thing that opens the panel (quick actions + custom name).
    arrowBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      const wasHidden = panel.classList.contains("tht-hidden")
      panel.classList.toggle("tht-hidden")
      if (wasHidden) refreshPanelHint(panel, betInput)
    })
    mainBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      handleAdd(panel, betInput, { flashEl: mainBtn })
    })

    document.addEventListener("click", (e) => {
      if (!root.contains(e.target)) panel.classList.add("tht-hidden")
    })

    betInputRef = betInput
    mainBtnRef = mainBtn
    return root
  }

  function updateDockLabel(detected) {
    if (!widgetRoot || widgetMode !== "float") return
    const nameEl = widgetRoot.querySelector('[data-role="dock-name"]')
    const providerEl = widgetRoot.querySelector('[data-role="dock-provider"]')
    const name = detected ? detected.slotName : ""
    const provider = detected && detected.provider ? detected.provider : SITE.name
    if (nameEl && nameEl.textContent !== name) nameEl.textContent = name
    if (providerEl && providerEl.textContent !== provider) providerEl.textContent = provider
  }

  // --- Mount / SPA navigation handling -------------------------------------

  function removeWidget() {
    if (widgetRoot) widgetRoot.remove()
    widgetRoot = null
    widgetMode = null
    currentAnchor = null
    betInputRef = null
    mainBtnRef = null
  }

  function ensureWidget() {
    const { siteEnabled, addBonus } = BonusTrackerState.settings
    if (!siteEnabled || !addBonus) {
      if (widgetRoot) removeWidget()
      return
    }

    if (widgetRoot && !document.body.contains(widgetRoot)) removeWidget()

    let anchor = null
    try {
      anchor = SITE.findAnchor ? SITE.findAnchor() : null
    } catch (err) {
      anchor = null
    }

    if (anchor) {
      if (widgetRoot && widgetMode === "inline" && currentAnchor === anchor) return
      removeWidget()
      widgetRoot = buildWidget("inline")
      widgetMode = "inline"
      anchor.appendChild(widgetRoot)
      currentAnchor = anchor
      return
    }

    // No inline spot: dock on game pages only.
    const detected = getSlot()
    if (!detected) {
      if (widgetRoot) removeWidget()
      return
    }
    if (!widgetRoot || widgetMode !== "float") {
      removeWidget()
      widgetRoot = buildWidget("float")
      widgetMode = "float"
      document.body.appendChild(widgetRoot)
    }
    updateDockLabel(detected)
  }

  function tick() {
    ensureWidget()
    checkAutoSync()
    markBonusedSlots()
  }

  setInterval(tick, 1000)

  // Throttled: casino SPAs mutate constantly (live bet feeds, chat), and the
  // marks only need to keep up with what a person can see.
  let mutationTimer = null
  new MutationObserver((mutations) => {
    // Ignore mutations caused by our own widget/toast updating themselves —
    // otherwise this loops (update widget -> observer -> update widget).
    const relevant = mutations.some((m) => {
      const t = m.target
      if (widgetRoot && (t === widgetRoot || widgetRoot.contains(t))) return false
      if (toastEl && (t === toastEl || toastEl.contains(t))) return false
      return true
    })
    if (!relevant || mutationTimer) return
    mutationTimer = setTimeout(() => {
      mutationTimer = null
      ensureWidget()
      markBonusedSlots()
    }, 200)
  }).observe(document.body, { childList: true, subtree: true })

  BonusTrackerState.subscribe(() => {
    ensureWidget()
    markBonusedSlots()
  })
  BonusTrackerState.init()
  ensureWidget()
})()

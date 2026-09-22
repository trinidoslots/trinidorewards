// content.js — injects a "+ Add Bonus" split button into Stake's game info
// row (next to the favourite/heart icon, in the same row as "Save Game" and
// the bet-amount pill). This matches where Stake's own native widgets live,
// instead of floating in the middle of the game canvas.
//
// Clicking the arrow opens a small panel (bet size + quick actions + a
// custom-name field) that opens UPWARD from the button, since the button
// sits near the bottom of the game card and a downward panel would run off
// the page.

;(function () {
  "use strict"

  let widgetRoot = null
  let currentAnchor = null
  let lastDetectedKey = ""

  // --- Slot / provider detection -------------------------------------------
  // Reads only the page's own visible title + publisher card, same technique
  // Stake uses to render its own UI — no hidden/internal selectors.

  function getStakeProvider() {
    const publisherH2 = document.querySelector('[data-testid="publisher-overview-card"] h2')
    if (publisherH2?.textContent?.trim()) return publisherH2.textContent.trim()

    const providerLink = document.querySelector('.card-wrapper a[href*="/casino/group/"]')
    if (providerLink) {
      const innerH2 = providerLink.querySelector("h2")
      const text = (innerH2 || providerLink).textContent.trim()
      if (text) return text
    }

    return null
  }

  function getStakeSlotDetails() {
    const mainTitle = document.querySelector(".card-wrapper .title-wrap h1") || document.querySelector(".card-wrapper h1")
    if (mainTitle) {
      return { slotName: mainTitle.textContent.trim(), provider: getStakeProvider(), imageUrl: getStakeSlotImage() }
    }
    return { slotName: null, provider: null, imageUrl: null }
  }

  // Reads the game's own thumbnail image straight off the page — same
  // artwork Stake itself shows in the game card / favourites list — so the
  // admin Opening page can display it without any manual upload step.
  function getStakeSlotImage() {
    const cardImg = document.querySelector(".card-wrapper img[src]")
    if (cardImg?.src) return cardImg.src

    const ogImage = document.querySelector('meta[property="og:image"]')
    if (ogImage?.content) return ogImage.content

    return null
  }

  // Reads the game's max-win multiplier and exclusivity badge out of the same
  // visible info row the title comes from.
  //
  // Matched on the page's own text rather than on class names. The row reads
  // "Only on Stake  <title>  <provider>  Potential 25,000x", and that text is
  // the part of the markup actually addressed to a reader, so it is the part
  // least likely to be renamed under us.
  //
  // NOT verified against the live site — written from a screenshot of the row.
  // Both fields are optional the whole way down, and the admin panel can
  // correct either, so a miss leaves the bar short rather than wrong.
  function getStakeGameMeta() {
    const wrap = document.querySelector(".card-wrapper")
    const text = (wrap && wrap.innerText) || ""

    const potential = text.match(/Potential\s*([\d][\d.,]*\s*x)/i)
    const exclusive = text.match(/Only on [A-Za-z.]+/i)

    return {
      maxWin: potential ? potential[1].replace(/\s+/g, "") : null,
      badge: exclusive ? exclusive[0] : null,
    }
  }

  // --- Anchor: the game info row (favourite/heart icon lives here) --------

  function findAnchorRow() {
    const fav = document.querySelector(".card-wrapper .favourite-wrap")
    return fav ? fav.parentElement : null
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
    const detected = getStakeSlotDetails()
    els.hint.textContent = detected.slotName
      ? `${detected.slotName}${detected.provider ? " · " + detected.provider : ""}`
      : "Could not detect a game on this page"

    if (els.slotInput && (!els.slotInput.value || els.slotInput.dataset.autoFilled === "true")) {
      els.slotInput.value = detected.slotName || ""
      els.slotInput.dataset.autoFilled = "true"
    }

    chrome.storage.local.get(["tht_last_bet_size"], (result) => {
      if (result.tht_last_bet_size && !betInput.value) {
        betInput.value = result.tht_last_bet_size
      }
    })
  }

  function setInlineStatus(betInput, message, kind) {
    betInput.classList.remove("tht-bet-pill-error", "tht-bet-pill-success")
    if (kind === "error") betInput.classList.add("tht-bet-pill-error")
    if (kind === "success") betInput.classList.add("tht-bet-pill-success")
    betInput.title = message || ""
    if (kind !== "pending") {
      setTimeout(() => {
        betInput.classList.remove("tht-bet-pill-error", "tht-bet-pill-success")
        betInput.title = ""
      }, 2500)
    }
  }

  // Brief scale + green-ring pulse on the main button, confirming the bonus
  // was added — mirrors the kind of instant feedback Stake's own UI gives.
  function flashSuccess(el) {
    if (!el) return
    el.classList.remove("tht-success-flash")
    void el.offsetWidth // force reflow so the animation restarts
    el.classList.add("tht-success-flash")
    el.addEventListener(
      "animationend",
      () => el.classList.remove("tht-success-flash"),
      { once: true },
    )
  }

  function handleAdd(panel, betInput, { badgeLabel, isSuperBonus, useCustomName, statusEl, flashEl } = {}) {
    const els = getPanelEls(panel)
    const betSize = Number.parseFloat(betInput.value)
    const reportError = (msg) => {
      if (statusEl) setStatus(statusEl, msg, "error")
      else setInlineStatus(betInput, msg, "error")
    }
    const reportPending = (msg) => {
      if (statusEl) setStatus(statusEl, msg, "pending")
      else setInlineStatus(betInput, msg, "pending")
    }
    const reportSuccess = (msg) => {
      if (statusEl) setStatus(statusEl, msg, "success")
      else setInlineStatus(betInput, msg, "success")
    }

    if (!betSize || Number.isNaN(betSize) || betSize <= 0) {
      reportError("Enter a valid bet size")
      return
    }

    const detected = getStakeSlotDetails()
    const gameName = useCustomName ? els.slotInput.value.trim() : detected.slotName

    if (!gameName) {
      reportError("Could not detect the game name")
      return
    }

    chrome.storage.local.set({ tht_last_bet_size: betSize })
    reportPending("Adding\u2026")

    chrome.runtime.sendMessage(
      {
        action: "addBonus",
        data: {
          gameName: badgeLabel ? `${gameName} (${badgeLabel})` : gameName,
          provider: detected.provider,
          betSize,
          isSuperBonus: !!isSuperBonus,
          imageUrl: detected.imageUrl,
        },
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reportError("Reload the page")
          return
        }

        if (response && response.success) {
          reportSuccess("Added!")
          flashSuccess(flashEl)
          panel.classList.add("tht-hidden")
          if (els.customFields) els.customFields.classList.add("tht-hidden")
        } else {
          reportError((response && response.error) || "Failed to add")
        }
      },
    )
  }

  // --- Now playing ---------------------------------------------------------
  // Sets the slot shown by the /obs/now-playing bar to whatever game this page
  // is. Separate from adding a bonus on purpose: the game you are about to play
  // and the game you are logging into the hunt are not always the same one.

  function handleNowPlaying(statusEl, { clear } = {}) {
    if (clear) {
      setStatus(statusEl, "Clearing\u2026", "pending")
      chrome.runtime.sendMessage({ action: "clearNowPlaying" }, (response) => {
        if (chrome.runtime.lastError) {
          setStatus(statusEl, "Reload the page", "error")
          return
        }
        if (response && response.success) setStatus(statusEl, "Cleared", "success")
        else setStatus(statusEl, (response && response.error) || "Failed to clear", "error")
      })
      return
    }

    const detected = getStakeSlotDetails()
    if (!detected.slotName) {
      setStatus(statusEl, "Could not detect the game", "error")
      return
    }

    const meta = getStakeGameMeta()
    setStatus(statusEl, "Setting\u2026", "pending")

    chrome.runtime.sendMessage(
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
      (response) => {
        if (chrome.runtime.lastError) {
          setStatus(statusEl, "Reload the page", "error")
          return
        }
        if (response && response.success) setStatus(statusEl, "On the overlay", "success")
        else setStatus(statusEl, (response && response.error) || "Failed to set", "error")
      },
    )
  }

  // --- Auto-sync -----------------------------------------------------------
  // Follows the page: when the game under you changes, the overlay's bar
  // changes with it, with no click at all.
  //
  // Off until switched on, and the state is remembered. On by default would
  // mean that installing this, or idly opening a game page to look at it,
  // silently changes what is on stream — the bar is the one thing here that
  // the audience sees immediately.
  //
  // There is no way to do this from the site's side: the database has no idea
  // which game is open in your browser, only this script does. So the push
  // starts here.

  const AUTO_KEY = "tht_now_playing_auto"

  // How long the same game has to stay on screen before it is pushed. Clicking
  // through four games looking for one should not put four of them on stream
  // in six seconds, and it keeps a slow-rendering page from pushing a title it
  // is about to replace.
  const AUTO_SETTLE_MS = 2500

  let autoEnabled = false
  let autoMenuEl = null
  let lastPushedSlot = ""
  let pendingSlot = ""
  let settleTimer = null

  chrome.storage.local.get([AUTO_KEY], (result) => {
    autoEnabled = !!result[AUTO_KEY]
    paintAutoMenu()
  })

  function paintAutoMenu() {
    if (autoMenuEl) {
      autoMenuEl.textContent = "Auto-update: " + (autoEnabled ? "on" : "off")
      autoMenuEl.classList.toggle("tht-muted", !autoEnabled)
    }
  }

  function setAutoEnabled(on, statusEl) {
    autoEnabled = !!on
    chrome.storage.local.set({ [AUTO_KEY]: autoEnabled })
    paintAutoMenu()

    if (autoEnabled) {
      // Push straight away rather than waiting for the next change: you turn
      // this on because the game in front of you is the one you are playing.
      lastPushedSlot = ""
      checkAutoSync(statusEl)
      if (statusEl) setStatus(statusEl, "Auto-update on", "success")
    } else if (statusEl) {
      setStatus(statusEl, "Auto-update off", "success")
    }
  }

  function pushNowPlaying(detected, meta, onDone) {
    chrome.runtime.sendMessage(
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

  function checkAutoSync(statusEl) {
    if (!autoEnabled) return

    const slot = getStakeSlotDetails().slotName || ""
    // No game on this page (a lobby, search results) is not a change — it
    // leaves whatever is on stream alone rather than clearing it.
    if (!slot || slot === lastPushedSlot || slot === pendingSlot) return

    pendingSlot = slot
    clearTimeout(settleTimer)
    settleTimer = setTimeout(() => {
      const settled = getStakeSlotDetails()
      if (!autoEnabled || settled.slotName !== slot) {
        pendingSlot = ""
        return
      }
      pushNowPlaying(settled, getStakeGameMeta(), (response) => {
        pendingSlot = ""
        if (response && response.success) {
          lastPushedSlot = slot
          if (statusEl) setStatus(statusEl, "On the overlay", "success")
        }
      })
    }, AUTO_SETTLE_MS)
  }

  function buildPanel() {
    const panel = document.createElement("div")
    panel.className = "tht-panel tht-hidden"
    panel.innerHTML = `
      <div class="tht-hint" data-role="hint"></div>
      <div class="tht-menu-item" data-role="quick-super">Add Super Bonus</div>
      <div class="tht-menu-item" data-role="quick-scatters">Add 5 Scatters</div>
      <div class="tht-divider"></div>
      <div class="tht-menu-item" data-role="now-playing">Set as now playing</div>
      <div class="tht-menu-item tht-muted" data-role="now-playing-clear">Clear now playing</div>
      <div class="tht-menu-item tht-muted" data-role="now-playing-auto">Auto-update: off</div>
      <div class="tht-divider"></div>
      <div class="tht-menu-item tht-muted" data-role="toggle-custom">+ Custom bonus\u2026</div>
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

  function buildWidget() {
    const root = document.createElement("div")
    root.id = "tht-widget-root"

    // Bet size pill — sits as its own field next to the button, matching
    // Stake's native "CA$ 0,2" bet-amount pill in the game info row.
    const betInput = document.createElement("input")
    betInput.type = "number"
    betInput.step = "0.01"
    betInput.className = "tht-bet-pill"
    betInput.placeholder = "Bet size"

    // Restore the last-used bet size immediately (not only when the dropdown
    // opens), so the value survives a full page refresh/navigation.
    chrome.storage.local.get(["tht_last_bet_size"], (result) => {
      if (result.tht_last_bet_size && !betInput.value) {
        betInput.value = result.tht_last_bet_size
      }
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
    arrowBtn.textContent = "\u25be"

    btnWrap.append(mainBtn, arrowBtn)

    const panel = buildPanel()
    root.append(betInput, btnWrap, panel)

    betInput.addEventListener("change", () => {
      chrome.storage.local.set({ tht_last_bet_size: Number.parseFloat(betInput.value) || 0 })
    })
    betInput.addEventListener("click", (e) => e.stopPropagation())

    const statusEl = panel.querySelector('[data-role="status"]')

    panel.querySelector('[data-role="quick-super"]').addEventListener("click", () => {
      handleAdd(panel, betInput, { badgeLabel: "Super Bonus", isSuperBonus: true, statusEl, flashEl: mainBtn })
    })
    panel.querySelector('[data-role="quick-scatters"]').addEventListener("click", () => {
      handleAdd(panel, betInput, { badgeLabel: "5 Scatters", statusEl, flashEl: mainBtn })
    })
    panel.querySelector('[data-role="now-playing"]').addEventListener("click", () => {
      handleNowPlaying(statusEl)
    })
    panel.querySelector('[data-role="now-playing-clear"]').addEventListener("click", () => {
      handleNowPlaying(statusEl, { clear: true })
    })
    autoMenuEl = panel.querySelector('[data-role="now-playing-auto"]')
    paintAutoMenu()
    autoMenuEl.addEventListener("click", () => {
      setAutoEnabled(!autoEnabled, statusEl)
    })
    panel.querySelector('[data-role="toggle-custom"]').addEventListener("click", () => {
      panel.querySelector('[data-role="custom-fields"]').classList.toggle("tht-hidden")
    })
    panel.querySelector('[data-role="cancel"]').addEventListener("click", () => {
      panel.classList.add("tht-hidden")
    })
    panel.querySelector('[data-role="confirm"]').addEventListener("click", () => {
      handleAdd(panel, betInput, { useCustomName: true, statusEl, flashEl: mainBtn })
    })
    panel.querySelector('[data-role="slot-name"]').addEventListener("input", (e) => {
      e.target.dataset.autoFilled = "false"
    })

    const togglePanel = (e) => {
      e.stopPropagation()
      const wasHidden = panel.classList.contains("tht-hidden")
      panel.classList.toggle("tht-hidden")
      if (wasHidden) refreshPanelHint(panel, betInput)
    }

    // Main button: adds the detected bonus for this game immediately, no
    // dropdown involved. The arrow is the only thing that opens the panel
    // (quick actions + custom name), matching Stake's own split-button UX.
    arrowBtn.addEventListener("click", togglePanel)
    mainBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      handleAdd(panel, betInput, { flashEl: mainBtn })
    })

    document.addEventListener("click", (e) => {
      if (!root.contains(e.target)) panel.classList.add("tht-hidden")
    })

    return root
  }

  // --- Mount / SPA navigation handling -------------------------------------

  function ensureWidget() {
    const anchor = findAnchorRow()
    if (!anchor) return

    if (widgetRoot && currentAnchor === anchor && document.body.contains(widgetRoot)) return

    if (widgetRoot) widgetRoot.remove()

    widgetRoot = buildWidget()
    anchor.appendChild(widgetRoot)
    currentAnchor = anchor
    lastDetectedKey = ""
  }

  function removeWidgetIfOrphaned() {
    if (widgetRoot && !document.body.contains(widgetRoot)) {
      widgetRoot = null
      currentAnchor = null
    }
  }

  setInterval(() => {
    removeWidgetIfOrphaned()
    ensureWidget()
    checkAutoSync()
  }, 1000)

  new MutationObserver(() => {
    removeWidgetIfOrphaned()
    ensureWidget()
  }).observe(document.body, { childList: true, subtree: true })

  ensureWidget()
})()

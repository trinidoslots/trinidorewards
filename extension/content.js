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

  // --- Safe chrome.* wrappers ------------------------------------------
  // Once this content script's extension context is invalidated (the
  // extension gets reloaded/updated while a Stake tab stays open),
  // chrome.runtime/chrome.storage calls throw synchronously — not just via
  // chrome.runtime.lastError — so every call site below is routed through
  // these helpers instead of calling the APIs directly. Without this, the
  // page's console fills with uncaught "Extension context invalidated"
  // errors (the poll loop alone would throw one every 5 seconds) until the
  // tab is refreshed.

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
        // chrome.storage/runtime calls are async — the context can become
        // invalidated between firing the call above and this callback
        // running, so accessing chrome.runtime.lastError here can itself
        // throw. That happens outside the try/catch above's stack frame,
        // so it needs its own guard.
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

  // --- Shared state: which bonuses are already in the current hunt --------
  // Populated by polling background.js (which hits the same hunt-status
  // endpoint popup.js already uses) and mirrored into chrome.storage.local,
  // the same pattern the original tracker used so multiple tabs stay in
  // sync without each one polling the API separately.
  const BonusTrackerState = {
    activeBonuses: [],
    isOpening: false,
    settings: {
      bonused: true,
      next: true,
    },
    listeners: [],

    init() {
      if (!isExtensionValid()) return

      safeStorageGet(
        ["currentHuntBonuses", "currentHuntIsOpening", "setting_bonused", "setting_next"],
        (result) => this.updateFromStorage(result),
      )

      try {
        chrome.storage.onChanged.addListener((changes, namespace) => {
          if (namespace !== "local") return
          const updates = {}
          if (changes.currentHuntBonuses) updates.currentHuntBonuses = changes.currentHuntBonuses.newValue
          if (changes.currentHuntIsOpening) updates.currentHuntIsOpening = changes.currentHuntIsOpening.newValue
          if (changes.setting_bonused) updates.setting_bonused = changes.setting_bonused.newValue
          if (changes.setting_next) updates.setting_next = changes.setting_next.newValue
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
        safeSendMessage({ action: "getHuntStatus" }, (response) => {
          if (!response || !response.success) return
          safeStorageSet({
            currentHuntBonuses: response.bonuses || [],
            currentHuntIsOpening: !!response.isOpening,
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
      if (data.setting_bonused !== undefined) {
        this.settings.bonused = data.setting_bonused !== false
        changed = true
      }
      if (data.setting_next !== undefined) {
        this.settings.next = data.setting_next !== false
        changed = true
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

  function getStakeSlotImage(slotName) {
    // Don't just grab "the first <img> in .card-wrapper" — that container
    // also holds the provider's logo (which sits before the box art in the
    // DOM on some layouts), so a plain querySelector picks up the wrong
    // picture. Instead, match on alt text the same way the "already
    // bonused" overlay matches game cards below: the slot's own thumbnail
    // is the only <img> on the page whose alt equals the title.
    const normalizedTarget = normalizeSlotName(slotName)
    if (normalizedTarget) {
      const images = document.querySelectorAll("img[alt]")
      for (const img of images) {
        if (normalizeSlotName(img.getAttribute("alt")) === normalizedTarget) {
          const src = img.getAttribute("src")
          if (src) return src
        }
      }
    }

    // Fallback: Stake's own social-share meta tag, present on every game
    // detail page even if the thumbnail markup changes shape.
    const ogImage = document.querySelector('meta[property="og:image"]')
    if (ogImage?.getAttribute("content")) return ogImage.getAttribute("content")

    return null
  }

  function getStakeSlotDetails() {
    const mainTitle = document.querySelector(".card-wrapper .title-wrap h1") || document.querySelector(".card-wrapper h1")
    if (mainTitle) {
      const slotName = mainTitle.textContent.trim()
      return { slotName, provider: getStakeProvider(), imageUrl: getStakeSlotImage(slotName) }
    }
    return { slotName: null, provider: null, imageUrl: null }
  }

  // Reads the game's max-win multiplier and exclusivity badge out of the info
  // row at the bottom of the game.
  //
  // Anchored on the Fun Play / Real Play buttons, which carry stable test ids
  // (data-testid="footer-fun-play-button"), and then walking up until we reach
  // the element that also holds the text. .card-wrapper — which this used to
  // read — belongs to the old layout, so on the current site it matched nothing
  // and both fields came back null on every single game. That is why the bar
  // never learned a multiplier or a badge: there was never anything to learn.
  //
  // Three scopes are tried in order, narrowest first, and the first one that
  // yields a match wins. The last is the whole page, which is a blunt fallback
  // but "Potential 25,000x" is a distinctive enough string to risk it.
  function getStakeMetaScopes() {
    const scopes = []

    const button = document.querySelector(
      '[data-testid="footer-fun-play-button"], [data-testid="footer-real-play-button"]',
    )
    if (button) {
      // Up to the row holding the buttons AND the text. Six is generous; the
      // buttons sit a couple of wrappers deep inside the footer.
      let node = button.parentElement
      for (let i = 0; i < 6 && node && node !== document.body; i++) {
        const text = node.innerText || ""
        if (/Potential/i.test(text) || /Only on/i.test(text)) { scopes.push(node); break }
        node = node.parentElement
      }
    }

    const card = document.querySelector(".card-wrapper")
    if (card) scopes.push(card)

    // Deliberately no document.body fallback. A page-wide text scan will
    // happily match a "Potential 25,000x" that belongs to something else
    // entirely — in testing it picked up the overlay bar rendered on the same
    // page and reported the wrong game. A missing field is recoverable; the
    // table remembers it and the admin panel can set it. A confidently wrong
    // multiplier on stream is not.
    return scopes
  }

  function getStakeGameMeta() {
    for (const scope of getStakeMetaScopes()) {
      const text = (scope && scope.innerText) || ""
      if (!text) continue

      const potential = text.match(/Potential\s*([\d][\d.,]*\s*x)/i)
      // Bounded to one capitalised word (plus an optional .eu / .us), because
      // adjacent elements can render with no whitespace between them and
      // [A-Za-z.]+ then swallows the next word whole: "Only on StakeThunder".
      const exclusive = text.match(/Only on ([A-Z][a-z]+(?:\.[a-z]{2,4})?)/)

      if (potential || exclusive) {
        return {
          maxWin: potential ? potential[1].replace(/\s+/g, "") : null,
          badge: exclusive ? ("Only on " + exclusive[1]).trim() : null,
        }
      }
    }
    return { maxWin: null, badge: null }
  }

  // --- Anchor: the game info row (favourite/heart icon lives here) --------

  function findAnchorRow() {
    const fav = document.querySelector(".card-wrapper .favourite-wrap")
    return fav ? fav.parentElement : null
  }

  // --- Already-bonused / next-to-open check ---------------------------------
  // Scans every game card on the page (grid listings, search results, the
  // detail page's own card, etc.) and greys out + badges any slot already in
  // the active hunt, plus highlights whichever unopened bonus is next in line.
  // Selector confirmed from the real working extension: cards are
  // `.game-card-wrap`, each containing an `img[alt]` (the slot name) and an
  // `.img-wrap` (where the badge/highlight gets attached).

  function normalizeSlotName(name) {
    return (name || "").toLowerCase().trim()
  }

  function markBonusedSlots() {
    if (!isExtensionValid()) return

    const gameCards = document.querySelectorAll(".game-card-wrap")

    if (gameCards.length === 0) return

    const hasPayout = BonusTrackerState.activeBonuses.some((b) => b.payout !== null && b.payout !== undefined)

    let nextBonusToOpen = null
    if (BonusTrackerState.isOpening) {
      const sortedBonuses = [...BonusTrackerState.activeBonuses].sort((a, b) => (a.order || 0) - (b.order || 0))
      nextBonusToOpen = sortedBonuses.find((b) => b.payout === null || b.payout === undefined)
    }

    let matchedCount = 0

    gameCards.forEach((card) => {
      const img = card.querySelector("img")
      if (!img) return

      const slotName = img.getAttribute("alt")
      if (!slotName) return

      const normalizedSlotName = normalizeSlotName(slotName)

      const bonus = BonusTrackerState.activeBonuses.find(
        (b) =>
          b.slotName &&
          normalizeSlotName(b.slotName) === normalizedSlotName &&
          (b.payout === null || b.payout === undefined),
      )

      const imgWrap = card.querySelector(".img-wrap")
      if (!imgWrap) return

      const isNext =
        nextBonusToOpen && nextBonusToOpen.slotName && normalizeSlotName(nextBonusToOpen.slotName) === normalizedSlotName

      // Next-to-open highlight
      if (isNext && BonusTrackerState.settings.next) {
        img.classList.add("tht-next-opening")
        imgWrap.style.overflow = "visible"

        let nextBadge = imgWrap.querySelector(".tht-next-badge")
        if (!nextBadge) {
          nextBadge = document.createElement("div")
          nextBadge.className = "tht-next-badge"
          nextBadge.textContent = "Next Bonus"
          imgWrap.appendChild(nextBadge)
        }
      } else {
        img.classList.remove("tht-next-opening")
        const nextBadge = imgWrap.querySelector(".tht-next-badge")
        if (nextBadge) nextBadge.remove()
      }

      // Already-bonused overlay
      if (bonus && !(BonusTrackerState.isOpening && hasPayout) && BonusTrackerState.settings.bonused) {
        img.classList.add("tht-bonused-img")
        matchedCount++

        let badge = imgWrap.querySelector(".tht-bonused-badge")
        if (!badge) {
          badge = document.createElement("div")
          badge.className = "tht-bonused-badge"
          imgWrap.appendChild(badge)
        }
        const badgeText = bonus.badgeLabel || "Already Bonused"
        if (badge.textContent !== badgeText) badge.textContent = badgeText
      } else {
        img.classList.remove("tht-bonused-img")
        const badge = imgWrap.querySelector(".tht-bonused-badge")
        if (badge) badge.remove()
      }
    })
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

    safeStorageGet(["tht_last_bet_size"], (result) => {
      if (result.tht_last_bet_size && !betInput.value) {
        betInput.value = result.tht_last_bet_size
      }
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

    safeStorageSet({ tht_last_bet_size: betSize })
    reportPending("Adding\u2026")

    safeSendMessage(
      {
        action: "addBonus",
        data: {
          // The name sent here must exactly match the slot's real title —
          // it's later matched against each game card's img[alt] to draw
          // the "already bonused" overlay. Any quick-action label (Super
          // Bonus, 5 Scatters) is sent separately below instead of being
          // appended to the name, so that matching never breaks.
          gameName,
          provider: detected.provider,
          betSize,
          isSuperBonus: !!isSuperBonus,
          badgeLabel: badgeLabel || null,
          imageUrl: detected.imageUrl || null,
        },
      },
      (response) => {
        if (!response) {
          reportError("Reload the page")
          return
        }

        if (response.success) {
          reportSuccess("Added!")
          flashSuccess(flashEl)
          panel.classList.add("tht-hidden")
          if (els.customFields) els.customFields.classList.add("tht-hidden")
        } else {
          reportError(response.error || "Failed to add")
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
      safeSendMessage({ action: "clearNowPlaying" }, (response) => {
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
      (response) => {
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

  safeStorageGet([AUTO_KEY], (result) => {
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
    safeStorageSet({ [AUTO_KEY]: autoEnabled })
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

    // Stake's game-info row itself is clickable (collapses/expands the card),
    // so every interaction anywhere inside our widget — buttons, the bet
    // input, the dropdown panel and its menu items — must be stopped here
    // once, at the root, instead of relying on each child element to guard
    // itself. Without this, clicking a menu item (Add Super Bonus, Add 5
    // Scatters, etc.) bubbles straight through to Stake's own handler and
    // toggles the card's expand/collapse state along with our own action.
    root.addEventListener("click", (e) => e.stopPropagation())
    root.addEventListener("mousedown", (e) => e.stopPropagation())

    // Bet size field — sits as its own field next to the button, matching
    // Stake's native "CA$ 0,2" bet-amount pill in the game info row.
    const betWrap = document.createElement("div")
    betWrap.className = "tht-bet-wrap"

    const betCurrency = document.createElement("span")
    betCurrency.className = "tht-bet-currency"
    betCurrency.textContent = "$"

    const betInput = document.createElement("input")
    betInput.type = "number"
    betInput.step = "0.01"
    betInput.className = "tht-bet-pill"
    betInput.placeholder = "Bet size"

    betWrap.append(betCurrency, betInput)

    // Restore the last-used bet size immediately (not only when the dropdown
    // opens), so the value survives a full page refresh/navigation.
    safeStorageGet(["tht_last_bet_size"], (result) => {
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
    root.append(betWrap, btnWrap, panel)

    betInput.addEventListener("change", () => {
      safeStorageSet({ tht_last_bet_size: Number.parseFloat(betInput.value) || 0 })
    })
    betInput.addEventListener("click", (e) => e.stopPropagation())

    const statusEl = panel.querySelector('[data-role="status"]')

    panel.querySelector('[data-role="quick-super"]').addEventListener("click", () => {
      handleAdd(panel, betInput, { badgeLabel: "Super Bonus", isSuperBonus: true, statusEl, flashEl: mainBtn })
    })
    panel.querySelector('[data-role="quick-scatters"]').addEventListener("click", () => {
      handleAdd(panel, betInput, { badgeLabel: "5 Scatters", isSuperBonus: true, statusEl, flashEl: mainBtn })
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
    markBonusedSlots()
  }, 1000)

  new MutationObserver((mutations) => {
    // Ignore mutations caused by our own widget updating itself — otherwise
    // this becomes an infinite loop (update widget -> triggers observer ->
    // update widget -> ...).
    const relevant = mutations.some((m) => {
      const t = m.target
      if (widgetRoot && (t === widgetRoot || widgetRoot.contains(t))) return false
      return true
    })
    if (!relevant) return

    removeWidgetIfOrphaned()
    ensureWidget()
    markBonusedSlots()
  }).observe(document.body, { childList: true, subtree: true })

  BonusTrackerState.subscribe(markBonusedSlots)
  BonusTrackerState.init()
  ensureWidget()
})()
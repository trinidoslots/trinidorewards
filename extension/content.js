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

  function buildPanel() {
    const panel = document.createElement("div")
    panel.className = "tht-panel tht-hidden"
    panel.innerHTML = `
      <div class="tht-hint" data-role="hint"></div>
      <div class="tht-menu-item" data-role="quick-super">Add Super Bonus</div>
      <div class="tht-menu-item" data-role="quick-scatters">Add 5 Scatters</div>
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
  }, 1000)

  new MutationObserver(() => {
    removeWidgetIfOrphaned()
    ensureWidget()
  }).observe(document.body, { childList: true, subtree: true })

  ensureWidget()
})()

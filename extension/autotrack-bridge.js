// autotrack-bridge.js — extension world, same game-provider frames as
// autotrack-injected.js. The page-world script cannot use chrome.* APIs, so it
// reports spins as DOM events and this forwards the ones the settings allow
// to background.js, which relays them to the casino page in the same tab.
//
//   bonus -> only when autotrack_<provider> is switched on
//   bet   -> only when "Sync bet size from game" is on, and only on change

;(function () {
  "use strict"
  if (window.__thtAutoTrackBridge) return
  window.__thtAutoTrackBridge = true

  var providerIds = (self.CONFIG && CONFIG.PROVIDERS ? CONFIG.PROVIDERS : []).map(function (p) {
    return p.id
  })
  var enabled = {}
  var syncBet = true
  var lastSentBet = null

  function valid() {
    try {
      return !!(chrome.runtime && chrome.runtime.id)
    } catch (e) {
      return false
    }
  }

  function apply(values) {
    providerIds.forEach(function (id) {
      var key = "autotrack_" + id
      if (key in values) enabled[id] = values[key] === true
    })
    if ("setting_syncBet" in values) syncBet = values.setting_syncBet !== false
  }

  function send(message) {
    if (!valid()) return
    try {
      chrome.runtime.sendMessage(message, function () {
        // Read lastError so a missing receiver is not reported as uncaught.
        try {
          void chrome.runtime.lastError
        } catch (e) {
          /* context invalidated */
        }
      })
    } catch (e) {
      /* extension reloaded while the game stayed open */
    }
  }

  try {
    var keys = providerIds
      .map(function (id) {
        return "autotrack_" + id
      })
      .concat(["setting_syncBet"])
    chrome.storage.local.get(keys, function (r) {
      try {
        if (!chrome.runtime.lastError) apply(r || {})
      } catch (e) {
        /* context invalidated */
      }
    })
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== "local") return
      var values = {}
      Object.keys(changes).forEach(function (k) {
        values[k] = changes[k].newValue
      })
      apply(values)
    })
  } catch (e) {
    return
  }

  // The last report from any game frame, for the popup's Auto Tracking
  // section: proof the extension reached the game at all, and from which host.
  var lastSeenWrite = 0
  function noteSeen(data) {
    var now = Date.now()
    if (data.type !== "bonus" && now - lastSeenWrite < 5000) return
    lastSeenWrite = now
    try {
      chrome.storage.local.set({
        autotrack_last_seen: { provider: data.provider, type: data.type, bet: data.bet, host: location.hostname, at: now },
      })
    } catch (err) {
      /* context invalidated */
    }
  }

  document.addEventListener("tht-autotrack", function (e) {
    var data
    try {
      data = JSON.parse(e.detail)
    } catch (err) {
      return
    }
    if (!data || providerIds.indexOf(data.provider) === -1) return
    noteSeen(data)

    if (data.type === "bonus") {
      if (!enabled[data.provider]) return
      send({ action: "autoTrackBonus", data: { provider: data.provider, bet: data.bet } })
    } else if (data.type === "bet") {
      if (!syncBet || !data.bet || data.bet === lastSentBet) return
      lastSentBet = data.bet
      send({ action: "autoTrackBet", data: { provider: data.provider, bet: data.bet } })
    }
  })
})()

// autotrack-injected.js — runs in the PAGE world of game-provider iframes
// (Pragmatic, Hacksaw, Stake Engine, Push Gaming, Relax, Quickspin).
//
// It mirrors the game's own calls to its round server and reports two things:
//   bet    — the base bet of each paid spin (fills the widget's bet field)
//   bonus  — a spin whose response enters free spins / a bonus round
// as a "tht-autotrack" DOM event carrying a JSON string. Strings, because an
// object created in the page world arrives as null in the extension's world.
//
// It never changes a request or response and reports nothing by itself:
// autotrack-bridge.js (extension world, same frame) decides whether the
// provider's toggle is on, and the casino page decides whether the hunt can
// take the bonus. Registered at document_start, because a game bundle that
// grabs its own XMLHttpRequest reference while loading would bypass a patch
// made any later.

;(function () {
  "use strict"
  if (window.__thtAutoTrack) return
  window.__thtAutoTrack = true

  var EVENT = "tht-autotrack"

  // Pragmatic's demo environment is a separate subdomain speaking the same
  // protocol — play money, never a hunt bonus.
  var DEMO_FRAME = /^demogamesfree/.test(location.hostname)

  // ===== helpers =====

  function num(v) {
    var n = typeof v === "string" ? Number(v) : v
    return typeof n === "number" && isFinite(n) ? n : null
  }

  function round2(v) {
    return Math.round(v * 100) / 100
  }

  function parseJSON(text) {
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch (e) {
      return null
    }
  }

  function parseParams(text) {
    var out = {}
    if (!text) return out
    try {
      new URLSearchParams(text).forEach(function (v, k) {
        out[k] = v
      })
    } catch (e) {
      /* not urlencoded */
    }
    return out
  }

  // Rounds already reported. A bonus resolves over several responses (free
  // spins, continue calls) that all carry the same round id.
  var seen = {}
  var seenOrder = []
  function firstTime(key) {
    if (seen[key]) return false
    seen[key] = true
    seenOrder.push(key)
    if (seenOrder.length > 300) delete seen[seenOrder.shift()]
    return true
  }

  var lastBet = {}

  function emit(type, provider, bet) {
    try {
      document.dispatchEvent(
        new CustomEvent(EVENT, {
          detail: JSON.stringify({ type: type, provider: provider, bet: bet ? round2(bet) : null }),
        }),
      )
    } catch (e) {
      /* never break the game */
    }
  }

  function bet(provider, value) {
    if (!value || value <= 0) return
    lastBet[provider] = value
    emit("bet", provider, value)
  }

  function bonus(provider, key, value) {
    if (!firstTime(provider + ":" + key)) return
    emit("bonus", provider, value || lastBet[provider] || null)
  }

  // ===== Pragmatic Play =====
  // POST .../gs2c/ge/v3/gameService, urlencoded both ways.
  //   request : action=doSpin&c=<coin>&l=<lines>...
  //   response: rid=<round>&tw=...&fs=<free spin #>&fsmax=<count>&na=s|c|b
  // The base bet is c * l from the REQUEST (with extra chance the response
  // reports more lines than were bet). doInit replays the last unfinished
  // round on load, so only doSpin counts. Free spins share their trigger's
  // rid, so the first response showing a free-spin or bonus state is the
  // trigger.

  function readPragmatic(reqText, respText) {
    var req = parseParams(reqText)
    if (req.action !== "doSpin") return
    var resp = parseParams(respText)

    var c = num(req.c)
    var l = num(req.l)
    var value = c !== null && l !== null ? c * l : null
    var inBonus = resp.fs !== undefined || resp.fsmax !== undefined || resp.na === "b"

    if (!inBonus) bet("pragmatic", value)
    if (inBonus && resp.rid) bonus("pragmatic", resp.rid, value)
  }

  // ===== Hacksaw / Backseat Gaming =====
  // POST /api/play/bet  {bets:[{betAmount, buyBonus?}], ...}
  //   -> {round:{roundId, status, events:[{etn, c, awa}]}, accountBalance}
  // Amounts in minor units (cents). The whole round, free spins included,
  // resolves in the first response; a bonus shows as a feature_enter event.
  // Demo mode is the same protocol under /demo/.

  function readHacksaw(reqText, respText) {
    var resp = parseJSON(respText)
    var round = resp && resp.round
    if (!round || !round.roundId) return
    var req = parseJSON(reqText)
    var first = req && req.bets && req.bets[0]
    var amount = first ? num(first.betAmount) : null
    var value = amount !== null ? amount / 100 : null
    // buyBonus also names ante modes ("mod_bonus" is a 9x extra-chance bet),
    // so a bet carrying it is not taken as the base bet.
    if (first && !first.buyBonus) bet("hacksaw", value)

    var events = round.events || []
    for (var i = 0; i < events.length; i++) {
      if (events[i] && events[i].etn === "feature_enter") {
        bonus("hacksaw", round.roundId, first && !first.buyBonus ? value : null)
        return
      }
    }
  }

  // ===== Stake Engine =====
  // POST /wallet/play {mode, currency, amount}  (micro-units: 1e6 = 1.00)
  //   -> {round:{betID, amount, mode, state}, balance}
  // Two bonus shapes: an array of events (freeSpinTrigger / bonusEnter), or an
  // object with info.freespins where prevRemaining === 0 marks the trigger.

  function stakeEngineTriggered(state) {
    if (!state) return false
    if (Array.isArray(state)) {
      for (var i = 0; i < state.length; i++) {
        var ev = state[i]
        if (ev && (ev.type === "freeSpinTrigger" || ev.type === "bonusEnter")) return true
      }
      return false
    }
    var fs = state.info && state.info.freespins
    return !!(fs && fs.active === true && num(fs.remaining) >= 1 && num(fs.prevRemaining) === 0)
  }

  function readStakeEngine(reqText, respText) {
    var resp = parseJSON(respText)
    var round = resp && resp.round
    if (!round) return
    var req = parseJSON(reqText) || {}
    var amount = num(req.amount)
    if (amount === null) amount = num(round.amount)
    var value = amount !== null ? amount / 1e6 : null
    var mode = String(req.mode || round.mode || "BASE").toUpperCase()
    if (mode === "BASE") bet("stakeengine", value)
    if (stakeEngineTriggered(round.state)) {
      bonus("stakeengine", round.betID != null ? round.betID : Date.now(), value)
    }
  }

  // ===== Push Gaming =====
  // POST /hive/b2c/game/<game>/api/actions-v2  {"action":"spin","bet":20}
  //   -> {actions:[{playId, totalBet, data:[{freeSpinsAwarded,
  //                                           numFreeSpinsAwarded}]}]}
  // Minor units (cents). totalBet stays the base bet even on feature bets.

  function readPush(reqText, respText) {
    var resp = parseJSON(respText)
    var actions = resp && resp.actions
    if (!actions || !actions.length) return
    var req = parseJSON(reqText) || {}
    for (var i = 0; i < actions.length; i++) {
      var action = actions[i] || {}
      var cents = num(action.totalBet)
      if (cents === null) cents = num(req.bet)
      var value = cents !== null ? cents / 100 : null
      if (req.action === "spin") bet("pushgaming", value)

      var data = action.data || []
      for (var j = 0; j < data.length; j++) {
        var d = data[j] || {}
        if (d.freeSpinsAwarded === true || num(d.numFreeSpinsAwarded) >= 1) {
          bonus("pushgaming", action.playId || action.actionId || Date.now(), value)
          break
        }
      }
    }
  }

  // ===== Relax Gaming / Print Studios and Quickspin =====
  // Same engine family. POST .../game/play  {ba, ga:"spin", ...}
  //   -> {roundId, ba, correspondingBa, subgameTriggered, buyFeature,
  //       buyFeatureMode, roundType}
  // Minor units. `ba` is what was staked; correspondingBa (Relax only) is the
  // base bet — they differ on enhanced bets and buys. Quickspin sends request
  // values as strings and has no correspondingBa.

  function readRelaxFamily(provider) {
    return function (reqText, respText) {
      var resp = parseJSON(respText)
      if (!resp || resp.roundId === undefined) return
      var req = parseJSON(reqText) || {}
      var bought = resp.buyFeature === true || req.buyFeature === true || num(resp.buyFeatureMode) > 0
      var enhanced = resp.enhancedBet === true || req.enhancedBet === true
      var base = num(resp.correspondingBa)
      if (base === null && !bought && !enhanced) base = num(req.ba) !== null ? num(req.ba) : num(resp.ba)
      var value = base !== null ? base / 100 : null

      if (!bought) bet(provider, value)
      if (resp.subgameTriggered === true || bought) bonus(provider, resp.roundId, value)
    }
  }

  // ===== routing =====

  var READERS = [
    {
      match: function (u) {
        return !DEMO_FRAME && u.indexOf("gameService") !== -1
      },
      read: readPragmatic,
    },
    {
      match: function (u) {
        return u.indexOf("/api/play/bet") !== -1 && u.indexOf("/demo/") === -1
      },
      read: readHacksaw,
    },
    {
      match: function (u) {
        return u.indexOf("/wallet/play") !== -1
      },
      read: readStakeEngine,
    },
    {
      match: function (u) {
        return u.indexOf("/api/actions-v2") !== -1
      },
      read: readPush,
    },
    {
      match: function (u) {
        return u.indexOf("qs-gaming") !== -1 && u.indexOf("/game/play") !== -1
      },
      read: readRelaxFamily("quickspin"),
    },
    {
      match: function (u) {
        return u.indexOf("/game/play") !== -1 && u.indexOf("qs-gaming") === -1
      },
      read: readRelaxFamily("relax"),
    },
  ]

  function pick(url) {
    var abs = ""
    try {
      abs = new URL(String(url), location.href).href
    } catch (e) {
      abs = String(url || "")
    }
    for (var i = 0; i < READERS.length; i++) {
      if (READERS[i].match(abs)) return READERS[i]
    }
    return null
  }

  function run(reader, reqText, respText) {
    try {
      reader.read(reqText, respText)
    } catch (e) {
      /* a malformed response must never break the game */
    }
  }

  function bodyToText(body) {
    if (typeof body === "string") return body
    try {
      if (body instanceof ArrayBuffer) return new TextDecoder().decode(body)
      if (ArrayBuffer.isView(body)) return new TextDecoder().decode(body)
      if (body instanceof URLSearchParams) return body.toString()
    } catch (e) {
      /* unreadable body */
    }
    return null
  }

  function xhrText(xhr) {
    var type = xhr.responseType
    try {
      if (!type || type === "text") return xhr.responseText
      if (type === "json") return xhr.response ? JSON.stringify(xhr.response) : null
      if (type === "arraybuffer" && xhr.response) return new TextDecoder().decode(xhr.response)
    } catch (e) {
      /* unreadable response */
    }
    return null
  }

  // ===== transport hooks (per realm) =====
  // Parameterised by window: every same-origin child iframe has its own fetch
  // and XMLHttpRequest, and some games deliberately make their requests from
  // a fresh child realm so that a patch on the parent's prototypes never
  // sees them.

  function hookRealm(win) {
    try {
      if (!win || win.__thtHooked) return
      win.__thtHooked = true
    } catch (e) {
      return // cross-origin realm — not ours to touch
    }

    var originalFetch = win.fetch
    if (typeof originalFetch === "function") {
      win.fetch = function (input, init) {
        var url = ""
        try {
          url = typeof input === "string" ? input : (input && input.url) || String(input)
        } catch (e) {
          url = ""
        }
        var reader = pick(url)
        if (!reader) return originalFetch.apply(this, arguments)

        // Read the request body before fetch consumes it.
        var bodyPromise
        try {
          if (init && init.body !== undefined) bodyPromise = Promise.resolve(bodyToText(init.body))
          else if (input && typeof input.clone === "function") bodyPromise = input.clone().text().catch(function () { return null })
          else bodyPromise = Promise.resolve(null)
        } catch (e) {
          bodyPromise = Promise.resolve(null)
        }

        var result = originalFetch.apply(this, arguments)
        result
          .then(function (response) {
            return Promise.all([bodyPromise, response.clone().text()])
          })
          .then(function (pair) {
            run(reader, pair[0], pair[1])
          })
          .catch(function () {})
        return result
      }
    }

    var XHR = win.XMLHttpRequest
    if (!XHR || !XHR.prototype) return
    var originalOpen = XHR.prototype.open
    var originalSend = XHR.prototype.send

    XHR.prototype.open = function (method, url) {
      try {
        this.__thtUrl = String(url)
      } catch (e) {
        this.__thtUrl = ""
      }
      return originalOpen.apply(this, arguments)
    }

    XHR.prototype.send = function (body) {
      var xhr = this
      var reader = pick(xhr.__thtUrl || "")
      if (reader) {
        var reqText = bodyToText(body)
        xhr.addEventListener("load", function () {
          var text = xhrText(xhr)
          if (text !== null) run(reader, reqText, text)
        })
      }
      return originalSend.apply(this, arguments)
    }
  }

  hookRealm(window)

  // Child realms: hook a same-origin iframe's window the moment the page asks
  // for it, before it can be used. A MutationObserver alone would be too late
  // for an iframe that is created, used and removed in one go.
  function wrapAccessor(proto, prop, toWindow) {
    try {
      var desc = Object.getOwnPropertyDescriptor(proto, prop)
      if (!desc || !desc.get || !desc.configurable) return
      var originalGet = desc.get
      Object.defineProperty(proto, prop, {
        configurable: true,
        enumerable: desc.enumerable,
        get: function () {
          var value = originalGet.call(this)
          try {
            hookRealm(toWindow(value))
          } catch (e) {
            /* cross-origin — the getter must still return */
          }
          return value
        },
      })
    } catch (e) {
      /* non-configurable in some engines */
    }
  }

  if (typeof HTMLIFrameElement !== "undefined") {
    wrapAccessor(HTMLIFrameElement.prototype, "contentWindow", function (w) {
      return w
    })
    wrapAccessor(HTMLIFrameElement.prototype, "contentDocument", function (d) {
      return d && d.defaultView
    })
  }

  // Backstop for window.frames[n], which bypasses both getters.
  try {
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes
        for (var j = 0; j < added.length; j++) {
          var node = added[j]
          if (node && node.tagName === "IFRAME") {
            try {
              hookRealm(node.contentWindow)
            } catch (e) {
              /* cross-origin */
            }
          }
        }
      }
    }).observe(document.documentElement || document, { childList: true, subtree: true })
  } catch (e) {
    /* no document element yet in this realm */
  }
})()

// config.js — shared by background.js, popup.js and content.js (loaded via
// <script>/importScripts/content_scripts, not an ES module, so it works
// unmodified in all three contexts).
//
// The API key no longer has to be pasted in here: open the extension popup →
// Settings → Connection and save it there (stored in chrome.storage.local).
// API_KEY below is only a fallback for builds that still ship a key in-file.
// `var`, not `const`: background.js re-injects this file into casino tabs that
// were already open when the extension was installed or updated, and a second
// `const` in the same content-script world is a SyntaxError.
var CONFIG = {
  BASE_URL: "https://trinidorewards.vercel.app",
  API_KEY: "PASTE_YOUR_EXTENSION_API_KEY_HERE",

  // Hosts the extension may talk to. Each one must also be listed in
  // host_permissions in manifest.json, or the background fetch is refused.
  SITE_OPTIONS: [
    { url: "https://trinidorewards.vercel.app", label: "trinidorewards.vercel.app" },
    { url: "https://trinidorewards.com", label: "trinidorewards.com" },
  ],

  // Casinos the on-page widget supports. `id` keys the per-site toggle
  // (storage key site_<id>, on unless switched off); the adapters that read
  // each page live in sites.js.
  CASINOS: [
    { id: "stake", name: "Stake" },
    { id: "gamdom", name: "Gamdom" },
    { id: "roobet", name: "Roobet" },
    { id: "shuffle", name: "Shuffle" },
    { id: "csgo500", name: "CSGO500" },
    { id: "gamba", name: "Gamba" },
    { id: "rainbet", name: "Rainbet" },
    { id: "thrill", name: "Thrill" },
    { id: "duelbits", name: "Duelbits" },
    { id: "razed", name: "Razed" },
    { id: "winna", name: "Winna" },
    { id: "acebet", name: "Acebet" },
    { id: "yeet", name: "Yeet" },
    { id: "degen", name: "Degen" },
  ],

  // Game providers auto-tracking understands (autotrack-injected.js). Storage
  // key autotrack_<id>, off unless switched on: an auto-add writes to the live
  // hunt, so it is opt-in per provider.
  PROVIDERS: [
    { id: "pragmatic", name: "Pragmatic Play", examples: "Gates of Olympus, Sweet Bonanza, etc." },
    { id: "hacksaw", name: "Hacksaw / Backseat Gaming", examples: "Wanted Dead or a Wild, Chaos Crew, etc." },
    { id: "stakeengine", name: "Stake Engine", examples: "Twist, Paperclip, Hen's Night, etc." },
    { id: "pushgaming", name: "Push Gaming", examples: "Big Bamboo, Razor Shark, etc." },
    { id: "relax", name: "Relax Gaming / Print Studios", examples: "Iron Bank, Money Train, etc." },
    { id: "quickspin", name: "Quickspin", examples: "Hammer of Vulcan, Big Bad Wolf, etc." },
  ],
}

if (typeof self !== "undefined") {
  self.CONFIG = CONFIG
}

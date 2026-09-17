// config.js — shared by background.js and popup.js (loaded via <script>/importScripts,
// not an ES module, so it works unmodified in both contexts).
//
// PASTE YOUR EXTENSION_API_KEY VALUE BELOW before loading this as an unpacked
// extension. This is the same value you set as the EXTENSION_API_KEY
// environment variable on the Trinidorewards project. It authenticates every
// request this extension makes to /api/extension/add-bonus.
const CONFIG = {
  BASE_URL: "https://trinidorewards.vercel.app",
  API_KEY: "PASTE_YOUR_EXTENSION_API_KEY_HERE",
}

if (typeof self !== "undefined") {
  self.CONFIG = CONFIG
}

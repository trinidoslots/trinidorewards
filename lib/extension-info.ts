/**
 * What the admin extension page shows about the Hunt Tracker extension.
 *
 * The casino and provider lists mirror CASINOS / PROVIDERS in
 * extension/config.js — that file is plain browser JS loaded by the
 * extension itself, so it cannot be imported here. Keep the two in step.
 *
 * The changelog is written by hand on purpose: Vercel builds from a shallow
 * clone, so there is no git history to read at runtime. Add an entry at the
 * top with every change that reaches the extension or its API, with the time
 * it went to production.
 */

export const EXTENSION_CASINOS = [
  "Stake",
  "Gamdom",
  "Roobet",
  "Shuffle",
  "CSGO500",
  "Gamba",
  "Rainbet",
  "Thrill",
  "Duelbits",
  "Razed",
  "Winna",
  "Acebet",
  "Yeet",
  "Degen",
] as const

export const EXTENSION_PROVIDERS = [
  { name: "Pragmatic Play", verified: true },
  { name: "Hacksaw / Backseat", verified: false },
  { name: "Stake Engine", verified: false },
  { name: "Push Gaming", verified: false },
  { name: "Relax / Print Studios", verified: false },
  { name: "Quickspin", verified: false },
] as const

export type ChangeKind = "extension" | "site"

export type ChangelogEntry = {
  /** Extension version, for releases of the extension itself. */
  version?: string
  /** ISO timestamp of the production deploy. */
  at: string
  kind: ChangeKind
  title: string
  changes: string[]
}

export const EXTENSION_CHANGELOG: ChangelogEntry[] = [
  {
    at: "2026-10-03T21:01:17+02:00",
    kind: "site",
    title: "Origin lock bypass and a new admin page",
    changes: [
      "/api/extension/* is let through the Cloudflare origin lock, so the extension keeps working on trinidorewards.vercel.app once the lock is switched back on. Every route there still requires the EXTENSION_API_KEY.",
      "This page: version, install and update steps, connection notes, supported casinos and providers, and this changelog.",
    ],
  },
  {
    version: "2.1.0",
    at: "2026-10-03T20:51:45+02:00",
    kind: "extension",
    title: "Gamba, working Pragmatic auto tracking, new dropdown icon",
    changes: [
      "Pragmatic auto tracking fixed: real spin responses carry no round id, so triggers were dropped. A bonus is now detected from the first free spin, bought or natural, once per bonus.",
      "Game-frame scripts also run in nested frames without their own address (about:blank / srcdoc / blob), and Blob request bodies are read — aimed at Hacksaw, still to be confirmed on a real game.",
      "Gamba.com added (floating dock, Already Bonused by game link).",
      "Stake dropdown arrow is a drawn chevron that flips while the menu is open.",
      "The casino page logs \"[Hunt Tracker] bet / bonus trigger from <provider>\" to the console.",
    ],
  },
  {
    version: "2.0.1",
    at: "2026-10-03T20:20:59+02:00",
    kind: "extension",
    title: "Casino tabs keep working through an update",
    changes: [
      "After an install or update the new copy is injected into casino tabs that were already open; the stale copy removes itself. Before, a tab left open looked fine but sent nothing (now playing stopped) until reloaded.",
    ],
  },
  {
    version: "2.0.0",
    at: "2026-10-03T20:00:04+02:00",
    kind: "extension",
    title: "Settings, more casinos, auto tracking",
    changes: [
      "New popup in the site's style with a settings view: casinos, auto tracking per provider, Add Bonus / Already Bonused / Next Bonus, pop-ups, now-playing options.",
      "API key and site are set in the popup (Settings → Connection) instead of pasted into config.js.",
      "Casinos beyond Stake, with a floating dock on game pages.",
      "Auto tracking: a triggered bonus is added at the bet spun (off by default, per provider), with bet sync and go-back-on-bonus.",
      "API returns when each bonus was added, for \"added … ago\" in the popup.",
    ],
  },
  {
    at: "2026-09-30T04:16:32+02:00",
    kind: "site",
    title: "Security fixes",
    changes: ["The extension's API key is compared in constant time, like the other machine tokens."],
  },
  {
    version: "1.0.0",
    at: "2026-09-22T17:33:04+02:00",
    kind: "extension",
    title: "Now-playing bar",
    changes: [
      "\"Set as now playing\" and auto-update push the open Stake game to /obs/now-playing.",
      "Max win and \"Only on Stake\" badge read from the game page; what is known about each slot is remembered.",
    ],
  },
  {
    version: "1.0.0",
    at: "2026-09-17T17:31:25+02:00",
    kind: "extension",
    title: "First version in the repository",
    changes: ["\"+ Add Bonus\" on Stake game pages with bet size, Super Bonus / 5 Scatters, Already Bonused and Next Bonus marks."],
  },
]

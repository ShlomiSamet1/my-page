// config.js — where the page finds the server (the "API").
//
// API_BASE is the start of the server's web address. The page adds a path
// to it, e.g. API_BASE + "/api/contact".
//   - On your computer (localhost), it's the test server started with
//     `npm.cmd run server`, which runs at http://localhost:8787
//   - On the live site, it's the real server on Cloudflare. Until the server is
//     put online, this is left empty ("") and the form falls back to a simulated send.
//
// This address is public on purpose: anyone may send a message to it.
// The secrets (API key, admin password) are never here; they live only on the server.

const LIVE_API = "https://my-page-api.samet16634-a22.workers.dev";

export const API_BASE = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? "http://localhost:8787"
  : LIVE_API;

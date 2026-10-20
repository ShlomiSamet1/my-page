// config.js — where the page finds the server (the "API").
//
// API_BASE is the start of the server's web address. The page adds a path
// to it, e.g. API_BASE + "/api/contact".
//
// Everywhere, by default, it's the real server on Cloudflare. So the live
// site and the site on your computer (http://localhost:5173) show the same
// messages and tasks, and use the same admin password.
//
// Only when changing the server's own code: start it on your computer with
// `npm.cmd run server`, then open the page with ?server=local at the end of
// the address (e.g. http://localhost:5173/admin.html?server=local). The tab
// remembers it until it's closed; ?server=live switches back.
//
// This address is public on purpose: anyone may send a message to it.
// The secrets (API key, admin password) are never here; they live only on the server.

const LIVE_API = "https://my-page-api.samet16634-a22.workers.dev";
const LOCAL_API = "http://localhost:8787";

const onThisComputer = ["localhost", "127.0.0.1"].includes(location.hostname);

// "local" if this tab asked for the server on this computer, otherwise "live"
function chosenServer() {
  const asked = new URLSearchParams(location.search).get("server");
  try {
    if (asked) sessionStorage.setItem("server", asked);
    return sessionStorage.getItem("server") || "live";
  } catch {
    return asked || "live"; // Storage blocked: only the address counts
  }
}

export const API_BASE =
  onThisComputer && chosenServer() === "local" ? LOCAL_API : LIVE_API;

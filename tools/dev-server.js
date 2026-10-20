// tools/dev-server.js — shows the website on your computer at http://localhost:5173
// Run it with `npm.cmd run site`, or double-click "Start website.cmd"
// (which also opens the browser). Stop it with Ctrl+C or by closing the window.
//
// Why we need it: opening index.html by double-clicking doesn't allow
// JavaScript modules (import) or calls to the server. A real web address does.
// It does what GitHub Pages does online: hand out the project's files.

const http = require("http"); // Node's built-in web server
const fs = require("fs"); // Reading files
const path = require("path"); // Working with file paths
const { exec } = require("child_process"); // Running a system command

const ROOT = path.join(__dirname, ".."); // The project folder
const PORT = process.env.PORT || 5173; // 5173 unless another port is given
// "--open" (used by Start website.cmd) opens this page in the browser
const OPEN_PAGE = process.argv.includes("--open") ? "/admin.html" : null;
// Tells the browser what kind of file it's receiving
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

http
  .createServer((request, response) => {
    // "/" means the home page; otherwise use the path asked for
    const urlPath = decodeURIComponent(request.url.split("?")[0]);
    const file = path.join(ROOT, urlPath === "/" ? "index.html" : urlPath);

    // Safety: only serve files inside the project folder, and never hidden
    // files or folders (names starting with "."), such as .env (the secrets)
    // or .wrangler (the local database)
    const hidden = urlPath.split("/").some((part) => part.startsWith("."));
    const blocked = !file.startsWith(ROOT) || hidden;
    if (blocked) {
      response.writeHead(403);
      return response.end("Forbidden");
    }

    fs.readFile(file, (error, content) => {
      if (error) {
        response.writeHead(404);
        return response.end("Not found");
      }
      const type = TYPES[path.extname(file)] || "application/octet-stream";
      response.writeHead(200, { "Content-Type": type });
      response.end(content);
    });
  })
  // If the address is already taken, the site is most likely already running
  // (e.g. in another window), so explain that instead of crashing, and still
  // open the page if asked: the running copy will show it
  .on("error", (error) => {
    if (error.code !== "EADDRINUSE") throw error;
    console.log(`Port ${PORT} is busy: the site is probably already running.`);
    console.log(`Open http://localhost:${PORT}, or stop the other one first.`);
    openBrowser();
  })
  .listen(PORT, () => {
    console.log(`Site running at http://localhost:${PORT}`);
    console.log("Keep this window open while you use it; close it to stop.");
    openBrowser();
  });

// Opens the page in the computer's default browser (only with --open).
// Each system has its own command for that.
function openBrowser() {
  if (!OPEN_PAGE) return;
  const url = `http://localhost:${PORT}${OPEN_PAGE}`;
  const command = {
    win32: `start "" "${url}"`, // Windows
    darwin: `open "${url}"`, // Mac
  }[process.platform];
  exec(command || `xdg-open "${url}"`); // Linux and others
}

@echo off
rem Start website.cmd - double-click to open your website on this computer.
rem It starts the small website server (tools\dev-server.js) and opens the
rem Admin page in your browser. The page uses the real Cloudflare server, so
rem you see your real messages and tasks. Close this window to stop it.
cd /d "%~dp0"
title My website (close this window to stop it)
node tools\dev-server.js --open
pause

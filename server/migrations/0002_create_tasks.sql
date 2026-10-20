-- 0002_create_tasks.sql — adds the table for the Admin page's Tasks tab.
-- Run it with `npm.cmd run db:online` (the real database) and
-- `npm.cmd run db:local` (the private test database). Wrangler remembers
-- that 0001 already ran, so only this file runs.

-- One row per task
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,               -- made by the page, e.g. "lq3x9a1b2"
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,   -- 0 = to do, 1 = done
  position INTEGER NOT NULL,         -- place in the list: 0 = top, 1, 2…
  created_at TEXT NOT NULL           -- when it was added, e.g. 2026-10-20T09:30:00Z
);

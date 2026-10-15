-- 0001_create_tables.sql — builds the database tables (a "migration").
-- A migration is a numbered set of database changes. Wrangler remembers which
-- ones it already ran, so running them again never duplicates anything.
-- Lines starting with -- are comments in SQL, the language databases use.

-- One row per message sent through the contact form
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, -- 1, 2, 3… given automatically
  name TEXT NOT NULL,
  pronouns TEXT NOT NULL DEFAULT '',    -- optional, so may be empty
  email TEXT NOT NULL,
  reason TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL              -- when it arrived, e.g. 2026-10-15T09:30:00Z
);

-- One row per contact or login attempt, used to limit how often someone can try
CREATE TABLE IF NOT EXISTS attempts (
  kind TEXT NOT NULL,   -- "contact" or "login"
  ip TEXT NOT NULL,     -- the visitor's internet address
  at INTEGER NOT NULL   -- when, in milliseconds since 1970
);

-- An index works like a book's index: it makes counting one IP's attempts fast
CREATE INDEX IF NOT EXISTS attempts_lookup ON attempts (kind, ip, at);

// server/index.js — the server (the "API") for the contact form and Admin page.
//
// It runs on Cloudflare Workers: Cloudflare keeps this code ready on its
// computers, and runs the fetch() function below every time a request arrives.
// On your computer, `npm.cmd run server` runs the same code locally.
//
// What it answers (method + path):
//   GET    /api/status              → is the server up, and is the API key loaded?
//   POST   /api/contact             → a visitor sends a message; we check and save it
//   POST   /api/admin/login         → the admin sends the password; gets a login token
//   GET    /api/admin/messages      → the admin (with token) gets all messages
//   DELETE /api/admin/messages/:id  → the admin (with token) deletes one message
//
// The Admin page's Tasks tab (all need the admin token too):
//   GET    /api/admin/tasks            → every task, in list order
//   POST   /api/admin/tasks            → add a task (or put a deleted one back, for Undo)
//   PATCH  /api/admin/tasks/:id        → change a task's text and/or done
//   DELETE /api/admin/tasks/:id        → delete one task
//   PUT    /api/admin/tasks/order      → save a new order (a list of ids, top first)
//   POST   /api/admin/tasks/clear-done → delete every finished task
//
// Secrets are read from "env" (short for environment):
//   env.API_KEY         the dummy API key (from .env locally, Cloudflare settings online)
//   env.ADMIN_PASSWORD  the admin's password (same places)
//   env.DB              the database where messages and tasks are saved (Cloudflare D1)
//   env.ALLOWED_ORIGINS the websites allowed to call this server (wrangler.jsonc)
// None of the secrets are ever sent back in a response.

import { validateContact, REASONS } from "../js/validation.js";

// ─── Settings ───

const MAX_BODY_BYTES = 10_000; // Reject requests bigger than ~10 KB
const TOKEN_HOURS = 8; // How long an admin login lasts
const MAX_TASKS = 500; // The most tasks the list may hold
const TASK_TEXT_MAX = 200; // The longest a task's text may be (same as the page)
// Rate limits: at most N attempts per visitor (IP address) in a time window.
// They stop someone flooding the inbox or guessing the password over and over.
const LIMITS = {
  contact: { max: 5, minutes: 10 },
  login: { max: 5, minutes: 15 },
};

// ─── The entry point: Cloudflare calls this for every request ───

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowed = allowedOrigin(origin, env);

    // Browsers send an OPTIONS "preflight" request first, asking
    // "may this website call you?". We answer with the CORS headers.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(allowed) });
    }

    // Browsers only let a page call another site's server if that server
    // says yes (CORS). We refuse requests coming from any other website.
    if (origin && !allowed) {
      return json(
        { error: "This website isn't allowed to call the server." },
        403,
      );
    }

    try {
      const response = await route(request, env, url);
      // Add the CORS headers to every answer, so the browser lets the page read it
      for (const [key, value] of Object.entries(cors(allowed))) {
        response.headers.set(key, value);
      }
      return response;
    } catch (error) {
      // Something unexpected broke. Log the details for us (visible in
      // `wrangler tail` / the terminal), but give the visitor only a plain message.
      console.error(error);
      return json(
        { error: "Something went wrong on the server." },
        500,
        allowed,
      );
    }
  },
};

// Sends each request to the function that handles its method + path
async function route(request, env, url) {
  const { pathname } = url;
  const method = request.method;

  if (method === "GET" && pathname === "/api/status") return status(env);
  if (method === "POST" && pathname === "/api/contact")
    return contact(request, env);
  if (method === "POST" && pathname === "/api/admin/login")
    return login(request, env);
  if (method === "GET" && pathname === "/api/admin/messages") {
    return withAdmin(request, env, () => listMessages(env));
  }
  // A regex that matches "/api/admin/messages/" followed by a number (the id)
  const match = pathname.match(/^\/api\/admin\/messages\/(\d+)$/);
  if (method === "DELETE" && match) {
    return withAdmin(request, env, () => deleteMessage(env, Number(match[1])));
  }

  // Tasks
  if (pathname === "/api/admin/tasks") {
    if (method === "GET") return withAdmin(request, env, () => listTasks(env));
    if (method === "POST") {
      return withAdmin(request, env, () => addTask(request, env));
    }
  }
  if (method === "PUT" && pathname === "/api/admin/tasks/order") {
    return withAdmin(request, env, () => orderTasks(request, env));
  }
  if (method === "POST" && pathname === "/api/admin/tasks/clear-done") {
    return withAdmin(request, env, () => clearDoneTasks(env));
  }
  // "/api/admin/tasks/" followed by a task id (letters and digits)
  const task = pathname.match(/^\/api\/admin\/tasks\/([a-z0-9]{1,40})$/i);
  if (method === "PATCH" && task) {
    return withAdmin(request, env, () => editTask(request, env, task[1]));
  }
  if (method === "DELETE" && task) {
    return withAdmin(request, env, () => deleteTask(env, task[1]));
  }
  return json({ error: "Not found." }, 404);
}

// ─── Handlers: one function per kind of request ───

// GET /api/status — a quick health check. Says whether the key is loaded,
// but never what the key is.
function status(env) {
  return json({
    ok: true,
    apiKeyLoaded: Boolean(env.API_KEY),
    adminPasswordSet: Boolean(env.ADMIN_PASSWORD),
  });
}

// POST /api/contact — a visitor's message.
// Steps: limit how often → read the data → check it with the shared rules →
// save it → use the API key to "notify" → answer.
async function contact(request, env) {
  const ip = clientIp(request);
  if (await tooManyAttempts(env, "contact", ip)) {
    return json(
      { error: "Too many messages. Please wait a few minutes." },
      429,
    );
  }

  const raw = await readJson(request);
  if (!raw) return json({ error: "The message couldn't be read." }, 400);

  // The same rules the browser used, run again here, because anyone can
  // call the server directly and skip the form's checks
  const { data, errors } = validateContact(raw);
  if (Object.keys(errors).length > 0) {
    return json({ error: "Please check the form and try again.", errors }, 400);
  }

  await recordAttempt(env, "contact", ip);

  // Save to the database. The "?" placeholders are filled in by bind(), which
  // keeps the visitor's text as plain data. Never paste user text straight
  // into SQL: that's how "SQL injection" attacks work.
  await env.DB.prepare(
    `INSERT INTO messages (name, pronouns, email, reason, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      data.name,
      data.pronouns,
      data.email,
      REASONS[data.reason], // Store the readable name, e.g. "Partnership"
      data.message,
      new Date().toISOString(), // The time, in a standard format
    )
    .run();

  await notifyAdmin(env, data);
  return json({ ok: true }, 201); // 201 = "created"
}

// POST /api/admin/login — checks the password and hands out a token.
// A token is like a wristband at an event: show it on later requests instead
// of sending the password every time. It expires after TOKEN_HOURS.
async function login(request, env) {
  if (!env.ADMIN_PASSWORD) {
    return json({ error: "The admin password isn't set on the server." }, 500);
  }
  const ip = clientIp(request);
  if (await tooManyAttempts(env, "login", ip)) {
    return json({ error: "Too many attempts. Please wait 15 minutes." }, 429);
  }

  const body = await readJson(request);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!(await sameText(password, env.ADMIN_PASSWORD))) {
    await recordAttempt(env, "login", ip); // Only wrong guesses count
    return json({ error: "Wrong password." }, 401); // 401 = "not logged in"
  }

  const expires = Date.now() + TOKEN_HOURS * 60 * 60 * 1000;
  return json({ token: await makeToken(expires, env), expires });
}

// GET /api/admin/messages — every message, newest first
async function listMessages(env) {
  const { results } = await env.DB.prepare(
    `SELECT id, name, pronouns, email, reason, message, created_at
     FROM messages ORDER BY id DESC`,
  ).all();
  return json({ messages: results });
}

// DELETE /api/admin/messages/:id — removes one message for good
async function deleteMessage(env, id) {
  const { meta } = await env.DB.prepare("DELETE FROM messages WHERE id = ?")
    .bind(id)
    .run();
  if (meta.changes === 0) return json({ error: "Message not found." }, 404);
  return json({ ok: true });
}

// ─── Tasks ───
// The page sends each change as it happens (add, edit, tick, delete, move),
// so the list in the database is always the latest one, on every device.

// GET /api/admin/tasks — every task, top of the list first.
// "done" is stored as 0 / 1 (databases have no true/false), so it's
// turned back into true / false for the page.
async function listTasks(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, text, done FROM tasks ORDER BY position, created_at",
  ).all();
  const tasks = results.map((task) => ({ ...task, done: task.done === 1 }));
  return json({ tasks });
}

// POST /api/admin/tasks — { id, text, done?, position? }
// Without a position, the task goes to the bottom. With one, it's an Undo
// putting a deleted task back where it was. If the id already exists
// (e.g. the request was sent twice), nothing changes.
async function addTask(request, env) {
  const body = await readJson(request);
  const id = taskId(body?.id);
  const text = taskText(body?.text);
  if (!id || !text) return json({ error: "The task couldn't be read." }, 400);

  const { count } = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM tasks",
  ).first();
  if (count >= MAX_TASKS) {
    return json({ error: `The list is full (${MAX_TASKS} tasks).` }, 400);
  }

  let position = body.position;
  if (!Number.isInteger(position) || position < 0) {
    const row = await env.DB.prepare(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM tasks",
    ).first();
    position = row.next;
  }

  // ON CONFLICT DO NOTHING = if this id is already saved, keep it as it is
  await env.DB.prepare(
    `INSERT INTO tasks (id, text, done, position, created_at)
     VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
  )
    .bind(
      id,
      text,
      body.done === true ? 1 : 0,
      position,
      new Date().toISOString(),
    )
    .run();
  return json({ ok: true }, 201);
}

// PATCH /api/admin/tasks/:id — { text?, done? }: only what's sent changes
async function editTask(request, env, id) {
  const body = await readJson(request);
  if (!body) return json({ error: "The change couldn't be read." }, 400);
  const changes = [];
  const values = [];
  if ("text" in body) {
    const text = taskText(body.text);
    if (!text) return json({ error: "A task can't be empty." }, 400);
    changes.push("text = ?");
    values.push(text);
  }
  if ("done" in body) {
    changes.push("done = ?");
    values.push(body.done === true ? 1 : 0);
  }
  if (changes.length === 0) return json({ error: "Nothing to change." }, 400);

  // The column names come from our own list above, never from the page;
  // the values still go through "?" placeholders
  const { meta } = await env.DB.prepare(
    `UPDATE tasks SET ${changes.join(", ")} WHERE id = ?`,
  )
    .bind(...values, id)
    .run();
  if (meta.changes === 0) return json({ error: "Task not found." }, 404);
  return json({ ok: true });
}

// DELETE /api/admin/tasks/:id — removes one task. The page offers Undo by
// sending it back with POST.
async function deleteTask(env, id) {
  await env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(id).run();
  return json({ ok: true }); // Already gone counts as success
}

// PUT /api/admin/tasks/order — { ids: [...] }, top of the list first.
// Every task gets its place number in one batch: all of them or none.
async function orderTasks(request, env) {
  const body = await readJson(request);
  const ids = Array.isArray(body?.ids) ? body.ids.map(taskId) : [];
  if (ids.length === 0 || ids.length > MAX_TASKS || ids.some((id) => !id)) {
    return json({ error: "The order couldn't be read." }, 400);
  }
  await env.DB.batch(
    ids.map((id, position) =>
      env.DB.prepare("UPDATE tasks SET position = ? WHERE id = ?").bind(
        position,
        id,
      ),
    ),
  );
  return json({ ok: true });
}

// POST /api/admin/tasks/clear-done — deletes every finished task
async function clearDoneTasks(env) {
  await env.DB.prepare("DELETE FROM tasks WHERE done = 1").run();
  return json({ ok: true });
}

// A task id: 1–40 letters and digits (the page makes them), otherwise null
function taskId(value) {
  return typeof value === "string" && /^[a-z0-9]{1,40}$/i.test(value)
    ? value
    : null;
}

// A task's text: trimmed, 1–200 characters, otherwise null
function taskText(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= TASK_TEXT_MAX ? text : null;
}

// ─── The API key: where the assignment's dummy key is used ───

// In a real setup, this would tell an email service (like Resend or SendGrid)
// to email you about the new message. Such services need an API key, sent in
// the "Authorization" header, which is exactly why it must stay on the server.
// Our key is a dummy, so instead of calling a real service we just log what
// would happen, showing only the key's last 4 characters.
async function notifyAdmin(env, data) {
  if (!env.API_KEY) {
    console.warn("API_KEY is missing: skipped the new-message notification.");
    return;
  }
  console.log(
    `New message from ${data.name}. Would notify the email service ` +
      `using API key …${env.API_KEY.slice(-4)}`,
  );
  // A real call would look like:
  // await fetch("https://api.email-service.example/send", {
  //   method: "POST",
  //   headers: { Authorization: `Bearer ${env.API_KEY}` },
  //   body: JSON.stringify({ subject: "New message", text: data.message }),
  // });
}

// ─── Admin login helpers ───

// Runs the given handler only if the request carries a valid, unexpired token.
// The page sends it in a header: "Authorization: Bearer <token>".
async function withAdmin(request, env, handler) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!(await validToken(token, env))) {
    return json({ error: "Please log in again." }, 401);
  }
  return handler();
}

// A token is "<expiry time>.<signature>". The signature is an HMAC: a
// fingerprint of the expiry time made with a secret (the admin password).
// Without the secret nobody can make a valid signature, so tokens can't be
// forged or have their expiry changed. Changing the password logs everyone out.
async function makeToken(expires, env) {
  return `${expires}.${await sign(String(expires), env.ADMIN_PASSWORD)}`;
}

async function validToken(token, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return sameText(signature, await sign(expires, env.ADMIN_PASSWORD));
}

// Makes an HMAC-SHA256 signature using the browser-standard crypto tools
async function sign(text, secret) {
  const encoder = new TextEncoder(); // Turns text into bytes
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign("HMAC", key, encoder.encode(text));
  // Turn the bytes into hex text (0-9, a-f) so it fits in a header
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Compares two texts in "constant time": it always takes the same time,
// whether the first letter or the last one differs. A normal === stops at
// the first difference, and an attacker could time that to guess a password
// letter by letter. Hashing both first makes them the same length.
async function sameText(a, b) {
  const encoder = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(hashA, hashB);
}

// ─── Rate limiting ───
// Each attempt is saved as a row (kind, ip, time). Before allowing another,
// we count this IP's rows of that kind inside the time window.

async function tooManyAttempts(env, kind, ip) {
  const { max, minutes } = LIMITS[kind];
  const since = Date.now() - minutes * 60 * 1000;
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM attempts WHERE kind = ? AND ip = ? AND at > ?",
  )
    .bind(kind, ip, since)
    .first();
  return row.count >= max;
}

async function recordAttempt(env, kind, ip) {
  // Also tidy up: delete attempts older than a day, so the table stays small
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM attempts WHERE at < ?").bind(dayAgo),
    env.DB.prepare("INSERT INTO attempts (kind, ip, at) VALUES (?, ?, ?)").bind(
      kind,
      ip,
      Date.now(),
    ),
  ]);
}

// ─── Small helpers ───

// The visitor's IP address, which Cloudflare provides in a header
function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "local";
}

// Reads the request body as JSON. Returns null if it's too big or not valid JSON.
async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    const value = JSON.parse(text);
    // Only accept a JSON object, like { "name": "..." }, not a list or a number
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : null;
  } catch {
    return null;
  }
}

// Returns the origin if it's in the allowed list, otherwise null
function allowedOrigin(origin, env) {
  const list = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());
  return origin && list.includes(origin) ? origin : null;
}

// The CORS headers: which website may read our answers, and which
// methods and headers it may use
function cors(origin) {
  if (!origin) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

// Builds a JSON response with a status code (200 = OK, 400 = bad request, …).
// "no-store" stops browsers from caching private data like the messages list.
function json(data, status = 200, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(origin === undefined ? {} : cors(origin)),
    },
  });
}

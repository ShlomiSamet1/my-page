# Notes

A short guide to every file in this project: what it does and how it works.
Each code file also has comments inside explaining its parts.

## Folder map

```
my-page/
│
│  THE WEBSITE (GitHub Pages; everything here is public)
├── index.html            the public page (home)
├── admin.html            the Admin page (Messages and Tasks tabs)
├── css/
│   └── style.css         how both pages look
├── js/                   what the pages do
│   ├── script.js         home: theme, animations, search
│   ├── contact-form.js   home: the contact form
│   ├── admin.js          Admin: login, tabs, messages
│   ├── tasks.js          Admin: the Tasks tab
│   ├── validation.js     form rules (also used by the server)
│   └── config.js         the server's address
│
│  THE SERVER (Cloudflare)
├── server/
│   ├── index.js          the server code
│   └── migrations/       how the database tables are built
├── wrangler.jsonc        Cloudflare settings for the server
│
│  TOOLS AND SETUP
├── tools/
│   └── dev-server.js     shows the website on your computer
├── package.json          project record card and commands (npm run …)
├── NOTES.md              this guide
├── .env                  secrets for your computer (never uploaded)
└── .env.example          template listing which secrets exist
```

The two `.html` pages stay at the top level on purpose: their place decides the
web addresses (`…/my-page/` and `…/my-page/admin.html`).

## Everyday workflow

1. **Start fresh.** In the project folder: `git checkout main`, then `git pull`.
2. **Make a branch** for the change, e.g. `git checkout -b new-feature`, so `main` (the live site) stays safe.
3. **Run it on your computer:** `npm.cmd run site` (website, http://localhost:5173) and, when you need the messages or login, `npm.cmd run server` (in a second terminal). Always open pages from `http://localhost:5173/…`, never by double-clicking the file.
4. **Edit and check** in the browser. Then `npm.cmd run format` to tidy the code.
5. **Save and upload:** `git add` the files, `git commit -m "what changed"`, `git push -u origin new-feature`, and open a pull request.
6. **Merge** on GitHub with **"Rebase and merge"**. The live site updates about a minute later.
7. **Server changes only** (`server/` or `wrangler.jsonc`): after merging, run `npm.cmd run deploy` to put the new server online.
8. Back to step 1.

## How the pieces fit

```
Visitor ──contact form──▶  SERVER (server/)  ──saves──▶  DATABASE (D1)
                              ▲
You ──Admin page + password───┘  server checks the password, then sends the messages
```

- The **website** (HTML, CSS, JS) is on GitHub Pages. Everything in it is public.
- The **server** is on Cloudflare Workers. Only it knows the secrets (`API_KEY`, `ADMIN_PASSWORD`).
- On your computer the secrets live in `.env`; online they're stored in Cloudflare's settings.

## The website (GitHub Pages)

### index.html

Page structure and content. Sticky header (logo, nav, theme toggle), hero (name, tagline, bio, CTAs), Journey section (stats row + timeline of roles with skills), Contact section (email link + form + privacy note) and footer (with a small Admin link). Loads `css/style.css`, `js/script.js` and `js/contact-form.js` (as a module); a small inline script applies the saved theme before first paint.

### admin.html + js/admin.js

The Admin page for reading messages. Anyone can open it, but it shows nothing until the server accepts the password. On login the server returns a token (a temporary pass, valid 8 hours), kept in `sessionStorage` and sent with each request; the password itself is never stored. After login there are two tabs, Messages and Tasks (arrow keys switch between them; the last one used is remembered), each with a small live count. Messages lists messages newest first with Reply in Gmail, Copy email and Delete. Messages are written as plain text only, so nothing a visitor types can run as code.

### js/tasks.js

The to-do list on the Admin page's Tasks tab (imported by `admin.js`). Add, tick done, edit (double-click or the pencil; Enter saves, Esc cancels), delete with an Undo pop-up (also Ctrl+Z), reorder by dragging the ⠿ handle (mouse or finger) or with ↑ ↓ on the handle, filter All / To do / Done, clear finished tasks, and a progress bar. Saved in `localStorage`, so the list lives in that browser only, not on the server. One `tasks` array is the single source of truth: every change updates it, saves it and redraws the list from it, with rows gliding to their new places.

### css/style.css

All visual styling. Colours are CSS variables in `:root`, overridden by `[data-theme="light"]`; dark is the default. Gold gradients (champagne, gold, rose gold, bronze) are applied to text via `background-clip: text` and to lines via `linear-gradient`. Includes the name shimmer and entrance keyframes, a viewport-based hero that fits one screen, the Admin page styles (tabs, task list, Undo pop-up), a mobile breakpoint, and a `prefers-reduced-motion` block that disables animations.

### js/script.js

Page behaviour. Toggles the theme and saves it in `localStorage`. Uses `IntersectionObserver` to fade in sections, highlight the active nav link, and run the stats count-up (`requestAnimationFrame`, ease-out). Animations are skipped under reduced motion.

### js/contact-form.js

The form's behaviour: checks each field as the visitor types (using the rules in `validation.js`), shows errors under the fields via `aria-live`, keeps a live character counter, and sends the message to the server with `fetch()`. If no server address is configured (`config.js`), sending is simulated.

### js/validation.js

The form rules (name, optional pronouns, email, reason from a fixed list, message 20–1000 characters), shared by the browser and the server. The browser uses them for instant feedback; the server runs them again, because anyone can call a server directly and skip the form.

### js/config.js

The server's address. On your computer it's `http://localhost:8787`; on the live site it's the Cloudflare address (`LIVE_API`), filled in once the server is online. Public on purpose: it contains no secrets.

## The server (Cloudflare Workers)

### server/index.js

The server code. Endpoints: `GET /api/status`, `POST /api/contact`, `POST /api/admin/login`, `GET /api/admin/messages`, `DELETE /api/admin/messages/:id`. Protections:

- Only the site's own addresses may call it (CORS).
- Every message is validated again on the server.
- Database queries use `?` placeholders, which prevents SQL injection.
- Login tokens are HMAC-signed and expire.
- Passwords are compared in constant time.
- Rate limits allow 5 messages per 10 minutes and 5 wrong passwords per 15 minutes per visitor.

The dummy `API_KEY` is read here to "notify" about new messages: it's logged as `…last4` instead of calling a real email service.

### wrangler.jsonc

Settings for Cloudflare: the server's name, its code file, the database connection, and which websites may call it. No secrets, so it's safe on GitHub.

### server/migrations/

SQL files that build the database tables (`messages`, and `attempts` for rate limiting). Wrangler remembers which ones have run.

### tools/dev-server.js

Shows the website on your computer at `http://localhost:5173`, like GitHub Pages does online. Refuses hidden files such as `.env`.

## Secrets

### .env (not on GitHub)

Holds `API_KEY` and `ADMIN_PASSWORD` for running the server on your computer. Wrangler loads it automatically. It's listed in `.gitignore`, so git never uploads it. Check this with `git check-ignore -v .env`, which should name the `.gitignore` line that ignores it.

### .env.example

A template with the same names and placeholder values. It is on GitHub, so anyone setting up the project knows which secrets to create.

### .gitignore

Lists what git should not upload: `node_modules/` (downloaded packages), `.env` and `.dev.vars` (secrets), and `.wrangler/` (local database and working files).

## Packages

### package.json

The project's record card: name, version, description, commands (`scripts`) and the packages it uses (`devDependencies`: Prettier and Wrangler). JSON can't contain comments, so explanations are kept in the `"//"` entry at the top, which npm ignores.

### package-lock.json

Generated by npm; never edit it by hand. Records the exact version of every installed package and everything they rely on, so `npm install` recreates the identical setup on any computer.

## Commands

Run these in the project folder. In PowerShell, type `npm.cmd` instead of `npm`, because Windows blocks the `npm.ps1` script by default.

| Command             | What it does                                                          |
| ------------------- | --------------------------------------------------------------------- |
| `npm install`       | Downloads the packages listed in `package.json` into `node_modules/`  |
| `npm run check`     | Lists files whose formatting Prettier would tidy; changes nothing     |
| `npm run format`    | Tidies the formatting (spacing, line breaks) of every file            |
| `npm run site`      | Shows the website at http://localhost:5173                            |
| `npm run server`    | Runs the server at http://localhost:8787, reading secrets from `.env` |
| `npm run db:local`  | Creates the database tables on your computer (once)                   |
| `npm run db:online` | Creates the database tables on Cloudflare (once, when going online)   |
| `npm run deploy`    | Puts the server online on Cloudflare                                  |

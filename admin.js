// admin.js — makes the Admin page work: log in, show messages, delete, log out.
//
// How login works:
//   1. You type the password; we send it to the server (POST /api/admin/login).
//   2. If it's right, the server replies with a "token", a temporary pass.
//   3. We keep the token in sessionStorage (it's erased when the tab closes)
//      and show it on every later request instead of the password.
//   4. When the token expires or you log out, we forget it and show the login again.
// The password itself is never stored in the browser.
//
// Safety: messages are written to the page with textContent (plain text), so
// even if someone types HTML or code into the contact form, it can't run here.

import { API_BASE } from "./config.js";

const TOKEN_KEY = "admin-token"; // The name the token is saved under

// Parts of the page
const loginSection = document.querySelector(".admin-login");
const loginForm = document.getElementById("login-form");
const passwordInput = document.getElementById("admin-password");
const passwordError = document.getElementById("admin-password-error");
const inbox = document.querySelector(".admin-inbox");
const list = document.querySelector(".admin-list");
const count = document.querySelector(".admin-count");
const template = document.getElementById("message-template");

// ─── Token storage (wrapped in try/catch: some browsers block storage) ───

function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
}

// ─── Talking to the server ───

// Calls the server and returns its JSON answer. Adds the token when we have one.
// If the server says 401 (not logged in / token expired), go back to the login.
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const reply = await response.json().catch(() => ({}));
  if (response.status === 401 && token) {
    showLogin("Your session ended. Please log in again.");
  }
  if (!response.ok) throw new Error(reply.error || "Something went wrong.");
  return reply;
}

// ─── Switching between the two views ───

function showLogin(message = "") {
  setToken(null);
  inbox.hidden = true;
  loginSection.hidden = false;
  passwordError.textContent = message;
  passwordInput.focus();
}

async function showInbox() {
  loginSection.hidden = true;
  inbox.hidden = false;
  await loadMessages();
}

// ─── Messages ───

// Asks the server for all messages and draws one card per message
async function loadMessages() {
  count.textContent = "Loading…";
  try {
    const { messages } = await api("/api/admin/messages");
    list.replaceChildren(...messages.map(renderMessage));
    count.textContent =
      messages.length === 1 ? "1 message" : `${messages.length} messages`;
  } catch (error) {
    count.textContent = error.message;
  }
}

// Builds one message card from the <template> in admin.html
function renderMessage(message) {
  const card = template.content.firstElementChild.cloneNode(true);
  const find = (selector) => card.querySelector(selector);

  find(".admin-name").textContent = message.name;
  find(".admin-pronouns").textContent = message.pronouns;
  find(".admin-email").textContent = message.email;
  find(".admin-email").href = `mailto:${message.email}`;
  find(".admin-reason").textContent = message.reason;
  find(".admin-text").textContent = message.message;

  // Show the date in the reader's own format, e.g. "15 Oct 2026, 16:30"
  const date = new Date(message.created_at);
  find(".admin-date").dateTime = message.created_at;
  find(".admin-date").textContent = date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // "Reply in Gmail" opens Gmail's "new email" screen in a new tab, with the
  // address and subject filled in. (A mailto: link would need an email app
  // installed on the computer, which Gmail-in-the-browser users don't have.)
  // URLSearchParams builds the "?to=...&su=..." part and makes the text safe
  // to put inside a link.
  const gmail = new URLSearchParams({
    view: "cm", // "compose"
    fs: "1", // full-screen compose window
    to: message.email,
    su: `Re: ${message.reason}`, // subject
  });
  find(".admin-reply").href = `https://mail.google.com/mail/?${gmail}`;

  const status = find(".admin-action-status");
  const deleteButton = find(".admin-delete");
  const confirmBox = find(".admin-confirm");

  // "Copy email" puts the address on the clipboard, for any email program
  find(".admin-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(message.email);
      status.textContent = "Email address copied.";
    } catch {
      status.textContent = "Couldn't copy. Select the address above instead.";
    }
  });

  // Delete is two steps, both on the page (browser pop-ups can be blocked):
  // 1. "Delete" swaps itself for "Delete for good? Yes / Cancel"
  deleteButton.addEventListener("click", () => {
    deleteButton.hidden = true;
    confirmBox.hidden = false;
    find(".admin-confirm-no").focus();
  });
  find(".admin-confirm-no").addEventListener("click", () => {
    confirmBox.hidden = true;
    deleteButton.hidden = false;
    deleteButton.focus();
  });
  // 2. "Yes, delete" actually deletes
  find(".admin-confirm-yes").addEventListener("click", () =>
    deleteMessage(message, status),
  );
  return card;
}

// Asks the server to delete one message (it can't be undone), then reloads the list
async function deleteMessage(message, status) {
  status.textContent = "Deleting…";
  try {
    await api(`/api/admin/messages/${message.id}`, { method: "DELETE" });
    await loadMessages(); // Redraw the list and the count without it
  } catch (error) {
    status.textContent = error.message;
  }
}

// ─── Event listeners ───

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  passwordError.textContent = "";
  if (!passwordInput.value) {
    passwordError.textContent = "Please enter the password.";
    return;
  }
  if (!API_BASE) {
    passwordError.textContent = "The server isn't online yet.";
    return;
  }
  try {
    const { token } = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: passwordInput.value }),
    });
    setToken(token);
    passwordInput.value = ""; // Don't keep the password on the page
    await showInbox();
  } catch (error) {
    passwordError.textContent =
      error instanceof TypeError ? "Couldn't reach the server." : error.message;
  }
});

document.getElementById("refresh").addEventListener("click", loadMessages);
document.getElementById("logout").addEventListener("click", () => showLogin());

// When the page opens: if this tab is already logged in, go straight to the messages
if (getToken()) showInbox();
else passwordInput.focus();

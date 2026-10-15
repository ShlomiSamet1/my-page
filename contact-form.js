// Contact form: checks every field before anything is sent, then sends the
// message to the server, which saves it for the Admin page.
// Whatever the visitor types is only ever shown as plain text, never as HTML.
//
// How the file is organised, top to bottom:
//   1. Imports: the shared rules (validation.js) and the server address (config.js)
//   2. Sending the message to the server
//   3. Functions that update the page (errors, counter, sending, success)
//   4. Event listeners: code that runs when the visitor types, leaves a
//      field, or presses Send
//
// This file is a "module" (index.html loads it with type="module"), which is
// what allows the "import" lines below.

// ─── 1. Imports ───
import {
  MESSAGE_MAX,
  clean,
  charCount,
  validateName,
  validatePronouns,
  validateEmail,
  validateReason,
  validateMessage,
} from "./validation.js";
import { API_BASE } from "./config.js";

// ─── 2. Sending ───

// Sends the message to the server and waits for its answer.
// fetch() is the browser's built-in way to call a server. We send:
//   method POST                       = "here is new data to store"
//   Content-Type: application/json    = the data is written as JSON
//   body                              = the answers, turned into JSON text
// "await" pauses until the server replies. If it replies with an error,
// we "throw" one, which jumps to the catch block in the submit handler.
async function sendMessage(data) {
  // No server configured yet (live site before the server is online):
  // pretend, like before. A Promise is "an answer that arrives later";
  // setTimeout delivers it after 1.2 seconds.
  if (!API_BASE) {
    return new Promise((resolve) =>
      setTimeout(() => resolve({ ok: true }), 1200),
    );
  }

  const response = await fetch(`${API_BASE}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  // response.ok is true for success codes (200–299)
  if (!response.ok) {
    // Try to read the server's explanation; fall back to a general message
    const reply = await response.json().catch(() => ({}));
    throw new Error(reply.error || "The server couldn't accept the message.");
  }
  return response.json();
}

// ─── 3. Updating the page ───

// Find the parts of the page this code works with (by id or class in index.html)
const form = document.getElementById("contact-form");
const submitButton = form.querySelector('button[type="submit"]');
const status = form.querySelector(".form-status");
const counter = document.getElementById("cf-message-count");
const success = document.querySelector(".form-success");

// A lookup table pairing each form box with the validator that checks it,
// so the rest of the code can handle every field with the same loop
const fields = {
  name: { input: document.getElementById("cf-name"), validate: validateName },
  pronouns: {
    input: document.getElementById("cf-pronouns"),
    validate: validatePronouns,
  },
  email: {
    input: document.getElementById("cf-email"),
    validate: validateEmail,
  },
  reason: {
    input: document.getElementById("cf-reason"),
    validate: validateReason,
  },
  message: {
    input: document.getElementById("cf-message"),
    validate: validateMessage,
  },
};

// Checks one field, shows or clears its error, and returns true if it's valid
function checkField(key) {
  const { input, validate } = fields[key];
  const error = validate(clean(input.value));
  // Each field has an error line below it with a matching id, e.g. "cf-name-error".
  // textContent shows the text as plain text, never as HTML (that's the safety rule).
  document.getElementById(`${input.id}-error`).textContent = error;
  // aria-invalid tells screen readers the field has a problem; style.css also
  // uses it to draw the red border
  input.setAttribute("aria-invalid", error ? "true" : "false");
  return !error;
}

// Updates the "0 / 1000" counter under the message box, turning it red
// (class "is-over") if the message is too long
function updateCounter() {
  const count = charCount(clean(fields.message.input.value));
  counter.textContent = `${count} / ${MESSAGE_MAX}`;
  counter.classList.toggle("is-over", count > MESSAGE_MAX);
}

// Switches the form in and out of its "Sending…" state
function setSending(isSending) {
  form.inert = isSending; // No editing or double-submitting while "sending"
  form.setAttribute("aria-busy", String(isSending));
  submitButton.textContent = isSending ? "Sending…" : "Send message";
  submitButton.classList.toggle("is-sending", isSending);
}

// Hides the form and shows the "Message sent" panel with a personal thank-you.
// Focus moves to the panel so keyboard and screen-reader users land on it.
function showSuccess({ name, email }) {
  success.querySelector(".success-text").textContent =
    `Thank you, ${name}. Your message is on its way, and I'll get back to you at ${email} soon.`;
  form.hidden = true;
  success.hidden = false;
  success.focus();
}

// ─── 4. Event listeners: code that waits for the visitor to do something ───

// Go through every field and attach two listeners to it
for (const [key, { input }] of Object.entries(fields)) {
  // Check when the visitor leaves a field they've typed in
  input.addEventListener("blur", () => {
    if (input.value || input.getAttribute("aria-invalid") === "true")
      checkField(key);
  });
  // Once a field shows an error, re-check while typing so the error clears as soon as it's fixed
  input.addEventListener("input", () => {
    if (input.getAttribute("aria-invalid") === "true") checkField(key);
  });
}

// Update the character counter on every keystroke in the message box
fields.message.input.addEventListener("input", updateCounter);
// Check the reason as soon as an option is picked
fields.reason.input.addEventListener("change", () => checkField("reason"));

// When Send is pressed. "async" lets us use "await" below to wait for sending.
form.addEventListener("submit", async (event) => {
  // Stop the browser's default behaviour (reloading the page) so our code decides
  event.preventDefault();
  status.textContent = ""; // Clear any old message under the button

  // Check every field (not stopping at the first) so all errors show at once
  const invalidKeys = Object.keys(fields).filter((key) => !checkField(key));
  if (invalidKeys.length > 0) {
    // Put the cursor in the first field that needs fixing, then stop here
    fields[invalidKeys[0]].input.focus();
    status.textContent = "Please fix the highlighted fields.";
    return;
  }

  // Everything is valid: collect the tidied answers into one package.
  // reason is sent as its short code (e.g. "partnership"); the server turns it
  // into the readable name when saving.
  const data = {
    name: clean(fields.name.input.value).replace(/\s+/g, " "),
    pronouns: clean(fields.pronouns.input.value).replace(/\s+/g, " "),
    email: clean(fields.email.input.value),
    reason: fields.reason.input.value,
    message: clean(fields.message.input.value),
  };

  // try / catch / finally:
  //   try     = attempt to send and show the thank-you
  //   catch   = runs only if sending failed: show the reason instead
  //   finally = runs either way: leave the "Sending…" state
  setSending(true);
  try {
    await sendMessage(data); // Pause here until sending finishes
    showSuccess(data);
  } catch (error) {
    // "Failed to fetch" means the server couldn't be reached at all
    const unreachable = error instanceof TypeError;
    status.textContent = unreachable
      ? "Couldn't reach the server. Please try again, or email me directly."
      : `${error.message} Please try again, or email me directly.`;
  } finally {
    setSending(false);
  }
});

// "Send another message" brings back an empty form
success.querySelector(".send-another").addEventListener("click", () => {
  form.reset(); // Empty every field
  // Remove all error marks and messages
  for (const { input } of Object.values(fields)) {
    input.removeAttribute("aria-invalid");
    document.getElementById(`${input.id}-error`).textContent = "";
  }
  updateCounter();
  success.hidden = true;
  form.hidden = false;
  fields.name.input.focus();
});

// Contact form: checks every field before anything is sent.
// Whatever the visitor types is only ever shown as plain text, never as HTML.
//
// How the file is organised, top to bottom:
//   1. Settings and patterns (the rules a valid answer must follow)
//   2. Helper functions that tidy and measure text
//   3. One validate… function per field. Each returns an error message,
//      or "" (empty text) when the answer is fine
//   4. Functions that update the page (errors, counter, sending, success)
//   5. Event listeners: code that runs when the visitor types, leaves a
//      field, or presses Send

// ─── 1. Settings ───

// Message length limits, in characters
const MESSAGE_MIN = 20;
const MESSAGE_MAX = 1000;
// The only accepted "reason" choices. Left side = the value inside the
// <select> in index.html; right side = the readable name used in the message.
const REASONS = {
  partnership: "Partnership",
  introduction: "Introduction",
  consulting: "Consulting",
  "join-network": "Joining the Worlds Meet network",
  other: "Other",
};

// The lines below are "regular expressions" (regex): compact patterns for
// matching text, written between two slashes /like this/. Letters after the
// closing slash change how they work: g = find every match, u = understand
// all languages and emoji properly.

// Invisible characters (zero-width spaces etc.) that can make empty text look filled in
const INVISIBLE = /[​-‍⁠﻿­]/g;
// Control characters, except tab and newline which are fine in a message
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

// Letters in any language (Hebrew, English, accents…), separated by spaces, hyphens,
// apostrophes or dots, e.g. "Shlomi Samet", "Jean-Luc O'Neil", "J. R. Smith"
const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '’.-]+[\p{L}\p{M}]+)*\.?$/u;
// Pronouns like "she/her", "they / them", "he, him" or "הוא"
const PRONOUNS_PATTERN =
  /^[\p{L}\p{M}]+(?:\s*[\/,]\s*[\p{L}\p{M}]+|\s+[\p{L}\p{M}]+)*$/u;
// The part of an email before the @: English letters, digits and _ % + -,
// with single dots allowed between them (e.g. "shlomi.samet")
const EMAIL_LOCAL = /^[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*$/;
// The part after the @: one or more labels ending in a dot (e.g. "worldsmeet."),
// each up to 63 characters and not starting or ending with a hyphen, followed
// by an ending of 2–63 letters (e.g. "com")
const EMAIL_DOMAIN =
  /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

// ─── 2. Helpers ───

// Removes invisible characters, unifies line endings and trims the ends
function clean(value) {
  return value.replace(INVISIBLE, "").replace(/\r\n?/g, "\n").trim();
}

// Counts characters the way a person would: an emoji counts as 1, not 2
function charCount(text) {
  return Array.from(text).length;
}

// ─── 3. Validators: one per field. Each returns "" if fine, or an error message ───
// Rules are checked in order, and the first broken rule decides the message,
// so the visitor gets the most useful hint first.

// Name: required, 2–80 characters, letters with spaces/hyphens/apostrophes
function validateName(value) {
  const name = value.replace(/\s+/g, " "); // Turn runs of spaces into one space
  if (!name) return "Please enter your name.";
  if (charCount(name) < 2) return "Name must be at least 2 characters.";
  if (charCount(name) > 80) return "Name must be 80 characters or fewer.";
  if (!NAME_PATTERN.test(name)) {
    return "Name can only contain letters, spaces, hyphens and apostrophes.";
  }
  return "";
}

// Pronouns: optional, up to 30 characters, like "she/her"
function validatePronouns(pronouns) {
  if (!pronouns) return ""; // Optional, so empty is fine
  if (charCount(pronouns) > 30)
    return "Pronouns must be 30 characters or fewer.";
  if (!PRONOUNS_PATTERN.test(pronouns)) {
    return "Use letters with slashes or spaces, like she/her or they/them.";
  }
  return "";
}

// Email: checked step by step, so the visitor learns exactly what's wrong.
// The length limits (254 total, 64 before the @, 253 after) are the
// official maximums for email addresses.
function validateEmail(email) {
  const invalid = "Please enter a valid email, like name@example.com.";
  if (!email) return "Please enter your email address.";
  if (/\s/.test(email)) return "Email can't contain spaces.";
  if (email.length > 254) return "Email is too long.";

  // Find the @. indexOf gives its position, or -1 if it isn't there.
  // lastIndexOf searches from the end: if the two positions differ,
  // there's more than one @.
  const at = email.indexOf("@");
  if (at === -1) return "Email is missing the @ sign.";
  if (at !== email.lastIndexOf("@"))
    return "Email can only contain one @ sign.";

  // Split into the part before the @ and the part after it, then check each
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!local || local.length > 64 || !EMAIL_LOCAL.test(local)) return invalid;
  if (!domain || domain.length > 253 || !EMAIL_DOMAIN.test(domain))
    return invalid;
  return "";
}

// Reason: must be one of the REASONS listed at the top
function validateReason(reason) {
  // Only accept one of our own options, even if someone edits the page
  if (!Object.hasOwn(REASONS, reason)) return "Please choose a reason.";
  return "";
}

// Message: 20–1000 characters of real words
function validateMessage(message) {
  if (!message) return "Please write a message.";
  if (CONTROL.test(message))
    return "Message contains characters that aren't allowed.";
  if (charCount(message) > MESSAGE_MAX) {
    return `Message must be ${MESSAGE_MAX} characters or fewer.`;
  }
  // Count runs of spaces as one, so 20 spaces in a row don't count as 20 characters
  if (charCount(message.replace(/\s+/g, " ")) < MESSAGE_MIN) {
    return `Message must be at least ${MESSAGE_MIN} characters.`;
  }
  // \p{L} = any letter, \p{N} = any digit, in any language
  if (!/[\p{L}\p{N}]/u.test(message))
    return "Message must contain words, not only symbols.";
  // Catches "aaaaaaaaaaaaaaaaaaaa" and similar keyboard mashing
  // How: a Set keeps only one copy of each character, so its size is the
  // number of *different* characters. Fewer than 4 means it isn't a real message.
  if (new Set(message.replace(/\s/g, "")).size < 4)
    return "Please write a real message.";
  return "";
}

// ─── 4. Sending and updating the page ───

// Pretends to send the message to a server: waits a moment, then reports success.
// Nothing is actually delivered yet. To make it real, replace the inside of this
// function with a fetch() call to your own server or a form service.
// A Promise is JavaScript's way of saying "the answer will arrive later".
// setTimeout waits 1200 milliseconds (1.2 s), then resolve() delivers the answer.
function sendMessage(data) {
  return new Promise((resolve) =>
    setTimeout(() => resolve({ ok: true }), 1200),
  );
}

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

// ─── 5. Event listeners: code that waits for the visitor to do something ───

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

  // Everything is valid: collect the tidied answers into one package
  const data = {
    name: clean(fields.name.input.value).replace(/\s+/g, " "),
    pronouns: clean(fields.pronouns.input.value).replace(/\s+/g, " "),
    email: clean(fields.email.input.value),
    reason: REASONS[fields.reason.input.value],
    message: clean(fields.message.input.value),
  };

  // try / catch / finally:
  //   try     = attempt to send and show the thank-you
  //   catch   = runs only if sending failed: show an error instead
  //   finally = runs either way: leave the "Sending…" state
  setSending(true);
  try {
    await sendMessage(data); // Pause here until sending finishes
    showSuccess(data);
  } catch {
    status.textContent =
      "Something went wrong. Please try again, or email me directly.";
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

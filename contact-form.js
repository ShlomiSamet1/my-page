// Contact form: checks every field before anything is sent.
// Whatever the visitor types is only ever shown as plain text, never as HTML.

const MESSAGE_MIN = 20;
const MESSAGE_MAX = 1000;
const REASONS = {
  partnership: "Partnership",
  introduction: "Introduction",
  consulting: "Consulting",
  "join-network": "Joining the Worlds Meet network",
  other: "Other",
};

// Invisible characters (zero-width spaces etc.) that can make empty text look filled in
const INVISIBLE = /[​-‍⁠﻿­]/g;
// Control characters, except tab and newline which are fine in a message
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

// Letters in any language (Hebrew, English, accents…), separated by spaces, hyphens,
// apostrophes or dots, e.g. "Shlomi Samet", "Jean-Luc O'Neil", "J. R. Smith"
const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '’.-]+[\p{L}\p{M}]+)*\.?$/u;
// Pronouns like "she/her", "they / them", "he, him" or "הוא"
const PRONOUNS_PATTERN = /^[\p{L}\p{M}]+(?:\s*[\/,]\s*[\p{L}\p{M}]+|\s+[\p{L}\p{M}]+)*$/u;
const EMAIL_LOCAL =/^[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*$/;
const EMAIL_DOMAIN = /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

// Removes invisible characters, unifies line endings and trims the ends
function clean(value) {
  return value.replace(INVISIBLE, "").replace(/\r\n?/g, "\n").trim();
}

// Counts characters the way a person would: an emoji counts as 1, not 2
function charCount(text) {
  return Array.from(text).length;
}

function validateName(value) {
  const name = value.replace(/\s+/g, " ");
  if (!name) return "Please enter your name.";
  if (charCount(name) < 2) return "Name must be at least 2 characters.";
  if (charCount(name) > 80) return "Name must be 80 characters or fewer.";
  if (!NAME_PATTERN.test(name)) {
    return "Name can only contain letters, spaces, hyphens and apostrophes.";
  }
  return "";
}

function validatePronouns(pronouns) {
  if (!pronouns) return ""; // Optional, so empty is fine
  if (charCount(pronouns) > 30) return "Pronouns must be 30 characters or fewer.";
  if (!PRONOUNS_PATTERN.test(pronouns)) {
    return "Use letters with slashes or spaces, like she/her or they/them.";
  }
  return "";
}

function validateEmail(email) {
  const invalid = "Please enter a valid email, like name@example.com.";
  if (!email) return "Please enter your email address.";
  if (/\s/.test(email)) return "Email can't contain spaces.";
  if (email.length > 254) return "Email is too long.";

  const at = email.indexOf("@");
  if (at === -1) return "Email is missing the @ sign.";
  if (at !== email.lastIndexOf("@")) return "Email can only contain one @ sign.";

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!local || local.length > 64 || !EMAIL_LOCAL.test(local)) return invalid;
  if (!domain || domain.length > 253 || !EMAIL_DOMAIN.test(domain)) return invalid;
  return "";
}

function validateReason(reason) {
  // Only accept one of our own options, even if someone edits the page
  if (!Object.hasOwn(REASONS, reason)) return "Please choose a reason.";
  return "";
}

function validateMessage(message) {
  if (!message) return "Please write a message.";
  if (CONTROL.test(message)) return "Message contains characters that aren't allowed.";
  if (charCount(message) > MESSAGE_MAX) {
    return `Message must be ${MESSAGE_MAX} characters or fewer.`;
  }
  if (charCount(message.replace(/\s+/g, " ")) < MESSAGE_MIN) {
    return `Message must be at least ${MESSAGE_MIN} characters.`;
  }
  if (!/[\p{L}\p{N}]/u.test(message)) return "Message must contain words, not only symbols.";
  // Catches "aaaaaaaaaaaaaaaaaaaa" and similar keyboard mashing
  if (new Set(message.replace(/\s/g, "")).size < 4) return "Please write a real message.";
  return "";
}

// Pretends to send the message to a server: waits a moment, then reports success.
// Nothing is actually delivered yet. To make it real, replace the inside of this
// function with a fetch() call to your own server or a form service.
function sendMessage(data) {
  return new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 1200));
}

const form = document.getElementById("contact-form");
const submitButton = form.querySelector('button[type="submit"]');
const status = form.querySelector(".form-status");
const counter = document.getElementById("cf-message-count");
const success = document.querySelector(".form-success");

const fields = {
  name: { input: document.getElementById("cf-name"), validate: validateName },
  pronouns: { input: document.getElementById("cf-pronouns"), validate: validatePronouns },
  email: { input: document.getElementById("cf-email"), validate: validateEmail },
  reason: { input: document.getElementById("cf-reason"), validate: validateReason },
  message: { input: document.getElementById("cf-message"), validate: validateMessage },
};

// Checks one field, shows or clears its error, and returns true if it's valid
function checkField(key) {
  const { input, validate } = fields[key];
  const error = validate(clean(input.value));
  document.getElementById(`${input.id}-error`).textContent = error;
  input.setAttribute("aria-invalid", error ? "true" : "false");
  return !error;
}

function updateCounter() {
  const count = charCount(clean(fields.message.input.value));
  counter.textContent = `${count} / ${MESSAGE_MAX}`;
  counter.classList.toggle("is-over", count > MESSAGE_MAX);
}

function setSending(isSending) {
  form.inert = isSending; // No editing or double-submitting while "sending"
  form.setAttribute("aria-busy", String(isSending));
  submitButton.textContent = isSending ? "Sending…" : "Send message";
  submitButton.classList.toggle("is-sending", isSending);
}

function showSuccess({ name, email }) {
  success.querySelector(".success-text").textContent =
    `Thank you, ${name}. Your message is on its way, and I'll get back to you at ${email} soon.`;
  form.hidden = true;
  success.hidden = false;
  success.focus();
}

for (const [key, { input }] of Object.entries(fields)) {
  // Check when the visitor leaves a field they've typed in
  input.addEventListener("blur", () => {
    if (input.value || input.getAttribute("aria-invalid") === "true") checkField(key);
  });
  // Once a field shows an error, re-check while typing so the error clears as soon as it's fixed
  input.addEventListener("input", () => {
    if (input.getAttribute("aria-invalid") === "true") checkField(key);
  });
}

fields.message.input.addEventListener("input", updateCounter);
fields.reason.input.addEventListener("change", () => checkField("reason"));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "";

  // Check every field (not stopping at the first) so all errors show at once
  const invalidKeys = Object.keys(fields).filter((key) => !checkField(key));
  if (invalidKeys.length > 0) {
    fields[invalidKeys[0]].input.focus();
    status.textContent = "Please fix the highlighted fields.";
    return;
  }

  const data = {
    name: clean(fields.name.input.value).replace(/\s+/g, " "),
    pronouns: clean(fields.pronouns.input.value).replace(/\s+/g, " "),
    email: clean(fields.email.input.value),
    reason: REASONS[fields.reason.input.value],
    message: clean(fields.message.input.value),
  };

  setSending(true);
  try {
    await sendMessage(data);
    showSuccess(data);
  } catch {
    status.textContent = "Something went wrong. Please try again, or email me directly.";
  } finally {
    setSending(false);
  }
});

// "Send another message" brings back an empty form
success.querySelector(".send-another").addEventListener("click", () => {
  form.reset();
  for (const { input } of Object.values(fields)) {
    input.removeAttribute("aria-invalid");
    document.getElementById(`${input.id}-error`).textContent = "";
  }
  updateCounter();
  success.hidden = true;
  form.hidden = false;
  fields.name.input.focus();
});

// validation.js — the contact form rules, shared by the page AND the server.
//
// Why a separate file: the browser checks the form so visitors get instant
// feedback, but anyone can send data straight to a server without using the
// form at all. So the server must check everything again. Keeping the rules
// in one file means both sides always agree, and a rule is changed in one place.
//
// "export" in front of a const or function makes it available to other files,
// which bring it in with "import { ... } from "./validation.js"".
//   - contact-form.js (in the browser) imports it
//   - worker/index.js (on the server) imports it

// ─── 1. Settings ───

// Message length limits, in characters
export const MESSAGE_MIN = 20;
export const MESSAGE_MAX = 1000;
// The only accepted "reason" choices. Left side = the value inside the
// <select> in index.html; right side = the readable name used in the message.
export const REASONS = {
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
export const INVISIBLE = /[​-‍⁠﻿­]/g;
// Control characters, except tab and newline which are fine in a message
export const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

// Letters in any language (Hebrew, English, accents…), separated by spaces, hyphens,
// apostrophes or dots, e.g. "Shlomi Samet", "Jean-Luc O'Neil", "J. R. Smith"
export const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '’.-]+[\p{L}\p{M}]+)*\.?$/u;
// Pronouns like "she/her", "they / them", "he, him" or "הוא"
export const PRONOUNS_PATTERN =
  /^[\p{L}\p{M}]+(?:\s*[\/,]\s*[\p{L}\p{M}]+|\s+[\p{L}\p{M}]+)*$/u;
// The part of an email before the @: English letters, digits and _ % + -,
// with single dots allowed between them (e.g. "shlomi.samet")
export const EMAIL_LOCAL = /^[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*$/;
// The part after the @: one or more labels ending in a dot (e.g. "worldsmeet."),
// each up to 63 characters and not starting or ending with a hyphen, followed
// by an ending of 2–63 letters (e.g. "com")
export const EMAIL_DOMAIN =
  /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

// ─── 2. Helpers ───

// Removes invisible characters, unifies line endings and trims the ends
export function clean(value) {
  return value.replace(INVISIBLE, "").replace(/\r\n?/g, "\n").trim();
}

// Counts characters the way a person would: an emoji counts as 1, not 2
export function charCount(text) {
  return Array.from(text).length;
}

// ─── 3. Validators: one per field. Each returns "" if fine, or an error message ───
// Rules are checked in order, and the first broken rule decides the message,
// so the visitor gets the most useful hint first.

// Name: required, 2–80 characters, letters with spaces/hyphens/apostrophes
export function validateName(value) {
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
export function validatePronouns(pronouns) {
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
export function validateEmail(email) {
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
export function validateReason(reason) {
  // Only accept one of our own options, even if someone edits the page
  if (!Object.hasOwn(REASONS, reason)) return "Please choose a reason.";
  return "";
}

// Message: 20–1000 characters of real words
export function validateMessage(message) {
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

// ─── 4. Check a whole message at once (used by the server) ───
// Takes the raw answers, tidies them exactly like the browser does, and runs
// every validator. Returns { data, errors }:
//   data   = the tidied answers, ready to save
//   errors = { fieldName: "message" } for each broken rule; empty if all is fine
export function validateContact(raw) {
  // Anything that isn't text (e.g. a number or missing value) counts as empty
  const text = (value) => (typeof value === "string" ? clean(value) : "");
  const data = {
    name: text(raw.name).replace(/\s+/g, " "),
    pronouns: text(raw.pronouns).replace(/\s+/g, " "),
    email: text(raw.email),
    reason: text(raw.reason),
    message: text(raw.message),
  };
  const errors = {};
  const checks = {
    name: validateName,
    pronouns: validatePronouns,
    email: validateEmail,
    reason: validateReason,
    message: validateMessage,
  };
  for (const [key, validate] of Object.entries(checks)) {
    const error = validate(data[key]);
    if (error) errors[key] = error;
  }
  return { data, errors };
}

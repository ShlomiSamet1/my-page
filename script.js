// script.js — the page's behaviour (everything that moves or reacts).
// It has four parts:
//   1. Light / dark theme toggle
//   2. Sections fading in as you scroll
//   3. Stats counting up from zero
//   4. Highlighting the menu link of the section you're reading
// index.html loads this file with "defer", so it runs only after the whole
// page has been built — that's why it can safely look up elements by class.

// ─── 1. Light / dark theme toggle — remembers the visitor's choice ───

// root = the <html> element. The theme is stored on it as data-theme="light";
// style.css reads that attribute and swaps every colour at once.
// No attribute at all means the default dark theme.
const root = document.documentElement;
// The round half-gold button in the header
const toggle = document.querySelector(".theme-toggle");

// Updates the button's hidden label, which screen readers announce for
// blind visitors. It describes what clicking will do next.
function setLabel() {
  const isLight = root.dataset.theme === "light";
  toggle.setAttribute(
    "aria-label",
    isLight ? "Switch to dark theme" : "Switch to light theme",
  );
}

// On click: flip to the other theme, save the choice, refresh the label
toggle.addEventListener("click", () => {
  // "a ? b : c" means: if a is true use b, otherwise use c
  const next = root.dataset.theme === "light" ? "dark" : "light";
  if (next === "light") {
    root.dataset.theme = "light";
  } else {
    delete root.dataset.theme; // Removing the attribute = back to dark
  }
  // localStorage is a small notebook the browser keeps for this site, so
  // the choice survives a page reload. "try / catch" means: attempt it, and
  // if the browser refuses (e.g. private mode), quietly carry on.
  try {
    localStorage.setItem("theme", next);
  } catch (e) {}
  setLabel();
});

// Set the correct label once when the page first loads
setLabel();

// ─── 2. Sections fade in gently as they scroll into view ───

// All the main content sections (Journey, Contact)
const sections = document.querySelectorAll("main .section");
// true if the visitor asked their device for less animation (an
// accessibility setting). We respect it by skipping the effects.
const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

// IntersectionObserver is a built-in browser tool that watches elements and
// tells us when they enter or leave the screen — no need to track scrolling
// ourselves. The "in window" check makes sure the browser supports it.
if ("IntersectionObserver" in window && !reducedMotion) {
  const revealer = new IntersectionObserver(
    // This function runs whenever a watched section crosses the threshold
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          // Adding "is-visible" triggers the fade-in written in style.css
          entry.target.classList.add("is-visible");
          // Each section only fades in once, so stop watching it
          revealer.unobserve(entry.target);
        }
      }
    },
    // Fire when 12% of the section is visible
    { threshold: 0.12 },
  );

  for (const section of sections) {
    // "will-reveal" hides the section (style.css) until it's revealed.
    // It's added here, not in the HTML, so if JavaScript is off nothing
    // stays hidden.
    section.classList.add("will-reveal");
    revealer.observe(section);
  }
}

// ─── 3. Stats count up from zero the first time they scroll into view ───
// The real numbers are already written in the page, so they still show without JavaScript.

// Every number that has a data-count="..." attribute in index.html
const statNumbers = document.querySelectorAll(".stat-num[data-count]");

// Animates one number from 0 up to its target over 1.6 seconds.
// Algorithm: on every screen refresh (about 60 times a second) work out
// how much of the time has passed (progress, from 0 to 1), bend it with an
// easing curve, and show target × eased progress.
function countUp(el) {
  const target = Number(el.dataset.count); // e.g. 20
  const suffix = el.dataset.suffix || ""; // e.g. "+", or nothing
  const duration = 1600; // milliseconds
  const start = performance.now(); // a precise "now" timestamp

  // One animation frame. The browser passes in the current time.
  function step(now) {
    // Fraction of the animation done: 0 at the start, capped at 1 at the end
    const progress = Math.min((now - start) / duration, 1);
    // Ease-out curve, written as the formula 1 − (1 − progress)³
    const eased = 1 - Math.pow(1 - progress, 3); // starts fast, slows down at the end
    // Show the rounded number; add the "+" only once we've finished
    el.textContent =
      Math.round(target * eased) + (progress === 1 ? suffix : "");
    // Not done yet? Ask the browser to call step again on the next frame
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

if ("IntersectionObserver" in window && !reducedMotion) {
  const counter = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          countUp(entry.target);
          counter.unobserve(entry.target); // Count up only once
        }
      }
    },
    // Wait until 60% of the number is visible, so the visitor sees it start
    { threshold: 0.6 },
  );

  for (const el of statNumbers) {
    el.textContent = "0"; // Start from zero, ready to count up
    counter.observe(el);
  }
}

// ─── 4. Highlights the menu link of the section you're currently reading ───

// Header links that jump to a section on this page (their href starts with #)
const navLinks = document.querySelectorAll('.site-header nav a[href^="#"]');

if ("IntersectionObserver" in window) {
  const tracker = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue; // Skip sections leaving the screen
        // Turn "is-active" on for the link pointing at this section
        // (e.g. href="#journey" for id="journey") and off for all others
        for (const link of navLinks) {
          link.classList.toggle(
            "is-active",
            link.getAttribute("href") === `#${entry.target.id}`,
          );
        }
      }
    },
    // Shrinks the "watch area" to a thin band across the middle of the
    // screen (cut 45% off the top, 50% off the bottom), so a section counts
    // as "current" only when it's in the middle of the screen
    { rootMargin: "-45% 0px -50% 0px" },
  );

  for (const section of sections) tracker.observe(section);
}

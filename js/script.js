// script.js — the page's behaviour (everything that moves or reacts).
// It has five parts:
//   1. Light / dark theme toggle
//   2. Sections fading in as you scroll
//   3. Stats counting up from zero
//   4. Highlighting the menu link of the section you're reading
//   5. Site search, like a friendly Ctrl+F
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
    if (el.dataset.done) return; // Already finished early by the search (part 5)
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

// Jumps every number straight to its final value and stops any counting.
// The search (part 5) calls this so it can find the real numbers ("20+"),
// and so a counting number can't wipe out a highlighted match.
function finishStats() {
  for (const el of statNumbers) {
    el.dataset.done = "true";
    el.textContent = el.dataset.count + (el.dataset.suffix || "");
  }
}

if ("IntersectionObserver" in window && !reducedMotion) {
  const counter = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          if (!entry.target.dataset.done) countUp(entry.target);
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

// ─── 5. Site search — finds words on the page, like a friendly Ctrl+F ───
// Each match is wrapped in a <mark class="search-hit">; the one you're on
// also gets "is-current". Clearing removes the marks again, leaving the
// page exactly as it was.

const searchBox = document.querySelector("#site-search");
const searchCount = document.querySelector("#site-search-count");
let hits = []; // The <mark> elements of the current search
let current = 0; // Position in hits of the match you're on

// Removes every <mark>, putting its text back where it was
function clearHits() {
  for (const mark of hits) {
    const parent = mark.parentNode;
    if (!parent) continue; // Already gone (e.g. a stat number re-counted)
    mark.replaceWith(...mark.childNodes);
    parent.normalize(); // Glue the split pieces of text back together
  }
  hits = [];
  searchCount.textContent = "";
}

// Every piece of visible text in <main>, except the contact form,
// hidden parts and decoration
function visibleText() {
  const main = document.querySelector("main");
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const skip = node.parentElement.closest(
      "form, [hidden], [aria-hidden='true']",
    );
    if (!skip && node.data.trim()) nodes.push(node);
  }
  return nodes;
}

// Moves to match number i (wraps around at both ends) and scrolls to it
function goTo(i) {
  hits[current].classList.remove("is-current");
  current = (i + hits.length) % hits.length;
  const mark = hits[current];
  mark.classList.add("is-current");
  // If its section hasn't faded in yet, show it now
  mark.closest(".will-reveal")?.classList.add("is-visible");
  // "center" keeps it well clear of the sticky header
  mark.scrollIntoView({
    block: "center",
    behavior: reducedMotion ? "auto" : "smooth",
  });
  searchCount.textContent = `${current + 1} of ${hits.length}`;
}

// Runs on every keystroke in the box
function search() {
  clearHits();
  const query = searchBox.value.trim().toLowerCase();
  if (query.length < 2) return; // Wait for at least 2 characters
  finishStats(); // Show the real numbers so they can be found too

  for (const node of visibleText()) {
    let rest = node;
    let at;
    // Split the text around each match and wrap the match in a <mark>
    while ((at = rest.data.toLowerCase().indexOf(query)) !== -1) {
      const match = rest.splitText(at);
      rest = match.splitText(query.length);
      const mark = document.createElement("mark");
      mark.className = "search-hit";
      match.replaceWith(mark);
      mark.append(match);
      hits.push(mark);
    }
  }

  current = 0;
  if (hits.length > 0) goTo(0);
  else searchCount.textContent = "No results";
}

searchBox.addEventListener("input", search);

// Enter = next match, Shift+Enter = previous, Esc = clear everything
searchBox.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && hits.length > 0) {
    event.preventDefault();
    goTo(current + (event.shiftKey ? -1 : 1));
  } else if (event.key === "Escape") {
    event.preventDefault();
    searchBox.value = "";
    clearHits();
  }
});

// Pressing "/" anywhere jumps to the search box — unless you're typing somewhere
document.addEventListener("keydown", (event) => {
  const typing = event.target.closest(
    "input, textarea, select, [contenteditable]",
  );
  if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey) {
    event.preventDefault(); // Don't type the "/" itself
    searchBox.focus();
  }
});

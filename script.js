// Light / dark theme toggle — remembers the visitor's choice
const root = document.documentElement;
const toggle = document.querySelector(".theme-toggle");

function setLabel() {
  const isLight = root.dataset.theme === "light";
  toggle.setAttribute("aria-label", isLight ? "Switch to dark theme" : "Switch to light theme");
}

toggle.addEventListener("click", () => {
  const next = root.dataset.theme === "light" ? "dark" : "light";
  if (next === "light") {
    root.dataset.theme = "light";
  } else {
    delete root.dataset.theme;
  }
  try {
    localStorage.setItem("theme", next);
  } catch (e) {}
  setLabel();
});

setLabel();

// Sections fade in gently as they scroll into view
const sections = document.querySelectorAll("main .section");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if ("IntersectionObserver" in window && !reducedMotion) {
  const revealer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12 });

  for (const section of sections) {
    section.classList.add("will-reveal");
    revealer.observe(section);
  }
}

// Highlights the menu link of the section you're currently reading
const navLinks = document.querySelectorAll('.site-header nav a[href^="#"]');

if ("IntersectionObserver" in window) {
  const tracker = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const link of navLinks) {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`);
      }
    }
  }, { rootMargin: "-45% 0px -50% 0px" });

  for (const section of sections) tracker.observe(section);
}

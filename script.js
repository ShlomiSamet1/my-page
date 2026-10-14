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

// Stats count up from zero the first time they scroll into view.
// The real numbers are already written in the page, so they still show without JavaScript.
const statNumbers = document.querySelectorAll(".stat-num[data-count]");

function countUp(el) {
  const target = Number(el.dataset.count);
  const suffix = el.dataset.suffix || "";
  const duration = 1600;
  const start = performance.now();

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // starts fast, slows down at the end
    el.textContent = Math.round(target * eased) + (progress === 1 ? suffix : "");
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

if ("IntersectionObserver" in window && !reducedMotion) {
  const counter = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        countUp(entry.target);
        counter.unobserve(entry.target);
      }
    }
  }, { threshold: 0.6 });

  for (const el of statNumbers) {
    el.textContent = "0";
    counter.observe(el);
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

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

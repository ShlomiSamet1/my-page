// tasks.js — makes the Tasks page work: add a task and show the list.
//
// How it's organised:
//   - "tasks" is the one list that holds everything (the single source of truth).
//   - Every action follows the same three moves: change "tasks", save(), render().
//   - render() rebuilds the list on screen from "tasks", so the screen can
//     never disagree with the saved data.
//
// Safety: task text is written with textContent (plain text), so even if
// someone types HTML or code into the box, it can't run here.

const STORAGE_KEY = "tasks"; // The name the list is saved under in localStorage

// Parts of the page
const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const list = document.querySelector(".task-list");
const empty = document.querySelector(".task-empty");

// Each task looks like { id: 1729..., text: "Call the bank", done: false }.
// "done" isn't used yet — it's ready for the "complete" step.
let tasks = load();

// Reads the saved list. If there's nothing saved, or it's broken, or the
// browser blocks storage (e.g. some private windows), start with an empty list.
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch (e) {
    return [];
  }
}

// Writes the list to localStorage. JSON.stringify turns it into text,
// because localStorage can only store text.
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (e) {} // Storage blocked: the list still works until the page closes
}

// Draws the list on the page from "tasks": wipe it, then add one <li> per task
function render() {
  list.replaceChildren();
  for (const task of tasks) {
    const item = document.createElement("li");
    item.className = "task-item";
    item.textContent = task.text;
    list.append(item);
  }
  empty.hidden = tasks.length > 0; // The "No tasks yet" line only when empty
}

// Adding a task. "submit" fires on the Add button and on Enter.
form.addEventListener("submit", (event) => {
  event.preventDefault(); // Stay on the page instead of reloading it
  const text = input.value.trim(); // trim() removes spaces at both ends
  if (text) {
    // Date.now() (milliseconds since 1970) gives each task a unique id
    tasks.push({ id: Date.now(), text, done: false });
    save();
    render();
  }
  input.value = "";
  input.focus(); // Ready for the next task
});

render(); // Show the saved tasks when the page opens

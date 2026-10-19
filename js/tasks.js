// tasks.js — the to-do list on the Admin page's "Tasks" tab.
// admin.js imports this file, so it runs once when the Admin page opens.
//
// What you can do:
//   - Add a task (type and press Enter or Add)
//   - Tick it done / not done (the checkbox)
//   - Edit it (double-click the text, or the pencil). Enter saves, Esc cancels.
//   - Delete it (the ×), with an "Undo" pop-up for a few seconds
//   - Reorder it: drag the ⠿ handle (mouse or finger), or focus the handle
//     and press ↑ / ↓
//   - Show All / To do / Done, and clear all finished tasks at once
//
// How it's organised:
//   - "tasks" is the one list that holds everything (the single source of truth).
//   - Every change follows the same moves: change "tasks", then commit(),
//     which saves it and redraws the list from it. So the screen can never
//     disagree with the saved data.
//   - The list is saved in localStorage: this browser only, not the server.
//
// Safety: task text is written with textContent (plain text), so even if
// someone types HTML or code into the box, it can't run here.

const STORAGE_KEY = "tasks"; // The names the list and the filter are saved under
const FILTER_KEY = "tasks-filter";
const UNDO_SECONDS = 6; // How long the "Undo" pop-up stays
const MOVE_MS = 220; // How long the slide animations take

// "Reduce motion" is a system setting for people who get dizzy from
// animations. When it's on, everything changes instantly instead.
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

// Parts of the page
const panel = document.getElementById("panel-tasks");
const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const list = panel.querySelector(".task-list");
const empty = panel.querySelector(".task-empty");
const hint = panel.querySelector(".task-hint");
const progressText = panel.querySelector(".task-progress-text");
const progressFill = panel.querySelector(".task-progress-fill");
const filterButtons = panel.querySelectorAll("[data-filter]");
const clearButton = panel.querySelector(".task-clear");
const announcer = document.getElementById("task-announce");
const toast = document.querySelector(".task-toast");
const toastText = toast.querySelector(".task-toast-text");
const undoButton = toast.querySelector(".task-toast-undo");
const template = document.getElementById("task-template");

// What the empty list says, depending on the filter
const EMPTY_TEXT = {
  none: "No tasks yet — add your first one above.",
  active: "Nothing left to do. Nice work!",
  done: "Nothing finished yet.",
};

// Each task looks like { id: "lq3x9a1b2", text: "Call the bank", done: false }
let tasks = load();
let filter = loadFilter(); // "all", "active" or "done"
let editingId = null; // The task being edited, if any
let newId = null; // The task just added, so it can slide in
let drag = null; // Details of the drag in progress, if any
let undoState = null; // A copy of the list from before the last delete
let undoTimer;
let onChange = () => {}; // Set by admin.js to update the tab's counter

// admin.js calls this to hear the number of open tasks whenever it changes
export function onTasksChange(callback) {
  onChange = callback;
  render();
}

// ─── Saving (wrapped in try/catch: some browsers block storage) ───

// Reads the saved list. If there's nothing saved or it's broken, start empty.
// Only well-formed tasks are kept, so a damaged save can't break the page.
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((task) => task && typeof task.text === "string" && task.text)
      .map((task) => ({
        id: String(task.id ?? makeId()),
        text: task.text.slice(0, 200),
        done: Boolean(task.done),
      }));
  } catch {
    return [];
  }
}

function loadFilter() {
  try {
    const saved = localStorage.getItem(FILTER_KEY);
    return ["active", "done"].includes(saved) ? saved : "all";
  } catch {
    return "all";
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    localStorage.setItem(FILTER_KEY, filter);
  } catch {} // Storage blocked: the list still works until the page closes
}

// A unique id: the time in base 36 plus a few random letters
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Drawing the list ───

// The tasks the current filter lets through, in order
function visibleTasks() {
  if (filter === "active") return tasks.filter((task) => !task.done);
  if (filter === "done") return tasks.filter((task) => task.done);
  return tasks;
}

// Save, then redraw. "before" (optional) is where each task was on screen
// beforehand, so they can glide to their new places (see render).
function commit(before) {
  save();
  render(before);
}

// Redraws the list, the progress bar, the filters and the counts from "tasks"
function render(before) {
  const shown = visibleTasks();
  list.replaceChildren(...shown.map(renderTask));
  newId = null;
  if (before) glide(before);

  const done = tasks.filter((task) => task.done).length;
  progressText.textContent = tasks.length
    ? `${done} of ${tasks.length} done`
    : "";
  progressFill.style.width = tasks.length
    ? `${(done / tasks.length) * 100}%`
    : "0%";

  empty.hidden = shown.length > 0;
  empty.textContent = tasks.length ? EMPTY_TEXT[filter] : EMPTY_TEXT.none;
  hint.hidden = shown.length === 0;
  clearButton.disabled = done === 0;
  for (const button of filterButtons) {
    button.setAttribute("aria-pressed", button.dataset.filter === filter);
  }
  onChange(tasks.length - done);
}

// Builds one task row from the <template> in admin.html
function renderTask(task) {
  const item = template.content.firstElementChild.cloneNode(true);
  const find = (selector) => item.querySelector(selector);

  item.dataset.id = task.id;
  item.classList.toggle("is-done", task.done);
  if (task.id === newId && !reduceMotion.matches) item.classList.add("is-new");
  find(".task-text").textContent = task.text;
  find(".task-check").checked = task.done;

  // Names for screen readers ("Delete: Call the bank") and mouse tooltips
  const label = (selector, action, tip) => {
    find(selector).setAttribute("aria-label", `${action}: ${task.text}`);
    find(selector).title = tip;
  };
  label(".task-check", "Done", "Mark as done");
  label(".task-handle", "Reorder", "Drag to reorder, or use ↑ ↓");
  label(".task-edit-btn", "Edit", "Edit");
  label(".task-delete", "Delete", "Delete");
  return item;
}

// Smooth moves ("FLIP"): each row starts where it used to be on screen and
// slides to its new place. "before" maps each task's id to its old position.
function glide(before) {
  if (reduceMotion.matches) return;
  for (const item of list.children) {
    const old = before.get(item.dataset.id);
    if (old === undefined) continue;
    const distance = old - item.getBoundingClientRect().top;
    if (!distance) continue;
    item.animate(
      [{ transform: `translateY(${distance}px)` }, { transform: "none" }],
      { duration: MOVE_MS, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
    );
  }
}

// Where each row is on screen right now (for glide)
function positions() {
  const map = new Map();
  for (const item of list.children) {
    map.set(item.dataset.id, item.getBoundingClientRect().top);
  }
  return map;
}

// Fades rows out, then runs "then" (which removes them from the list)
function fadeOut(items, then) {
  if (reduceMotion.matches || items.length === 0) return then();
  for (const item of items) item.classList.add("is-leaving");
  setTimeout(then, 180);
}

// ─── Small helpers ───

const itemOf = (id) => list.querySelector(`[data-id="${CSS.escape(id)}"]`);
const taskOf = (element) =>
  tasks.find((task) => task.id === element.closest(".task-item")?.dataset.id);

// Puts the keyboard focus on a part of a task's row (or the "New task" box)
function focusTask(id, selector) {
  const item = id && itemOf(id);
  const target = item ? item.querySelector(selector) : input;
  target.focus({ preventScroll: true });
}

// The visible task after this one (or before it, if it's the last)
function neighbourOf(task) {
  const shown = visibleTasks();
  const index = shown.indexOf(task);
  return (shown[index + 1] || shown[index - 1])?.id;
}

// Says something to screen-reader users without changing what's on screen
function announce(message) {
  announcer.textContent = message;
}

// Long task names are shortened in messages: "Call the bank about the…"
function short(text) {
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

// ─── Adding ───

// "submit" fires on the Add button and on Enter
form.addEventListener("submit", (event) => {
  event.preventDefault(); // Stay on the page instead of reloading it
  const text = input.value.trim(); // trim() removes spaces at both ends
  input.value = "";
  input.focus();
  if (!text) return;

  const task = { id: makeId(), text, done: false };
  tasks.push(task);
  newId = task.id;
  if (filter === "done") filter = "all"; // Otherwise the new task would be hidden
  commit();
  itemOf(task.id).scrollIntoView({ block: "nearest", behavior: "smooth" });
  announce(`Added “${short(text)}”.`);
});

// Esc empties the box
input.addEventListener("keydown", (event) => {
  if (event.key === "Escape") input.value = "";
});

// ─── Done / not done ───

list.addEventListener("change", (event) => {
  if (!event.target.matches(".task-check")) return;
  const task = taskOf(event.target);
  task.done = event.target.checked;
  announce(task.done ? "Marked as done." : "Marked as to do.");

  // With "To do" or "Done" showing, the task now belongs to the other view:
  // fade it out, and move the focus to the next one
  const stillShown = filter === "all" || (filter === "done") === task.done;
  if (stillShown) {
    commit();
    focusTask(task.id, ".task-check");
  } else {
    const next = neighbourOf(task);
    fadeOut([itemOf(task.id)], () => {
      commit(positions());
      focusTask(next, ".task-check");
    });
  }
});

// ─── Editing ───

// Swaps the text for a box with the text in it, ready to type
function startEdit(id) {
  if (editingId) finishEdit(true, false);
  const task = tasks.find((task) => task.id === id);
  const item = itemOf(id);
  const box = item.querySelector(".task-edit");
  editingId = id;
  item.classList.add("is-editing");
  item.querySelector(".task-text").hidden = true;
  box.hidden = false;
  box.value = task.text;
  box.focus();
  box.select();
}

// keep = save the new text (false = Esc, put the old text back).
// refocus = put the focus back on the pencil, for keyboard users.
// An empty box keeps the old text, so a task is never lost by accident.
function finishEdit(keep, refocus) {
  const id = editingId;
  if (!id) return; // Already finished (e.g. Enter, then the box lost focus)
  editingId = null;
  const task = tasks.find((task) => task.id === id);
  const text = itemOf(id).querySelector(".task-edit").value.trim();
  if (keep && text && text !== task.text) {
    task.text = text;
    announce("Task updated.");
  }
  commit();
  if (refocus) focusTask(id, ".task-edit-btn");
}

list.addEventListener("dblclick", (event) => {
  if (event.target.matches(".task-text")) startEdit(taskOf(event.target).id);
});

// Clicking somewhere else while editing saves the change
list.addEventListener("focusout", (event) => {
  if (event.target.matches(".task-edit")) finishEdit(true, false);
});

// ─── Deleting, with Undo ───

function deleteTask(task) {
  const item = task && itemOf(task.id);
  if (!item || item.classList.contains("is-leaving")) return; // Double click
  const next = neighbourOf(task);
  offerUndo(`Deleted “${short(task.text)}”`);
  fadeOut([item], () => {
    tasks = tasks.filter((other) => other !== task);
    commit(positions());
    focusTask(next, ".task-delete");
  });
}

clearButton.addEventListener("click", () => {
  const finished = tasks.filter((task) => task.done);
  if (finished.length === 0) return;
  offerUndo(
    finished.length === 1
      ? "Cleared 1 finished task"
      : `Cleared ${finished.length} finished tasks`,
  );
  fadeOut([...list.querySelectorAll(".is-done")], () => {
    tasks = tasks.filter((task) => !task.done);
    commit(positions());
  });
});

// Keeps a copy of the list from before the change and shows the pop-up
function offerUndo(message) {
  undoState = tasks.map((task) => ({ ...task }));
  toastText.textContent = message;
  toast.classList.add("is-visible");
  startUndoTimer();
}

function startUndoTimer() {
  clearTimeout(undoTimer);
  undoTimer = setTimeout(hideToast, UNDO_SECONDS * 1000);
}

function hideToast() {
  clearTimeout(undoTimer);
  toast.classList.remove("is-visible");
  undoState = null;
}

function undo() {
  if (!undoState) return;
  tasks = undoState;
  hideToast();
  commit();
  announce("Undone.");
  input.focus({ preventScroll: true });
}

undoButton.addEventListener("click", undo);
// The pop-up waits while the mouse is over it
toast.addEventListener("mouseenter", () => clearTimeout(undoTimer));
toast.addEventListener("mouseleave", () => undoState && startUndoTimer());

// Ctrl+Z (Cmd+Z on Mac) also undoes, unless you're typing in a box
document.addEventListener("keydown", (event) => {
  const typing = event.target.matches("input[type=text], input:not([type])");
  if (undoState && !typing && (event.ctrlKey || event.metaKey)) {
    if (event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
    }
  }
});

// ─── Buttons in each row ───

list.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.matches(".task-edit-btn")) startEdit(taskOf(button).id);
  if (button.matches(".task-delete")) deleteTask(taskOf(button));
});

// ─── Keyboard: Enter / Esc while editing, ↑ / ↓ on the handle ───

list.addEventListener("keydown", (event) => {
  if (event.target.matches(".task-edit")) {
    if (event.key === "Enter" || event.key === "Escape") {
      event.preventDefault();
      finishEdit(event.key === "Enter", true);
    }
    return;
  }
  if (event.target.matches(".task-handle")) {
    const step = { ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (!step) return;
    event.preventDefault(); // Don't scroll the page
    const task = taskOf(event.target);
    const from = visibleTasks().indexOf(task);
    if (moveTask(from, from + step)) focusTask(task.id, ".task-handle");
  }
});

// Moves a task from one place to another in the list you're looking at.
// With a filter on, the places are those of the visible tasks, so the task
// lands right next to the one it was dropped on.
function moveTask(from, to, before = positions()) {
  const shown = visibleTasks();
  if (to < 0 || to >= shown.length || to === from) return false;
  const moved = shown[from];
  const target = shown[to];
  tasks.splice(tasks.indexOf(moved), 1);
  tasks.splice(tasks.indexOf(target) + (to > from ? 1 : 0), 0, moved);
  commit(before);
  announce(`Moved to position ${to + 1} of ${shown.length}.`);
  return true;
}

// ─── Dragging to reorder (mouse, pen or finger) ───
// While you drag, the row follows the pointer and the others slide out of
// its way. Nothing is saved until you let go.

list.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest(".task-handle");
  if (!handle || event.button !== 0 || editingId) return;
  event.preventDefault(); // No text selecting while dragging
  handle.focus({ preventScroll: true });

  const item = handle.closest(".task-item");
  const items = [...list.children];
  const tops = items.map((el) => el.getBoundingClientRect().top + scrollY);
  const heights = items.map((el) => el.offsetHeight);
  const from = items.indexOf(item);
  const gap = parseFloat(getComputedStyle(list).rowGap) || 0;

  drag = {
    pointer: event.pointerId,
    item,
    items,
    tops, // Each row's place on the page when the drag began
    heights,
    from,
    to: from,
    slot: heights[from] + gap, // How far the others move to make room
    startY: event.clientY + scrollY,
    pointerY: event.clientY,
  };
  // "Capture" = keep receiving the pointer's moves even outside the handle
  handle.setPointerCapture(event.pointerId);
  item.classList.add("is-dragging");
  list.classList.add("is-sorting");
  drag.frame = requestAnimationFrame(autoScroll);
});

list.addEventListener("pointermove", (event) => {
  if (!drag || event.pointerId !== drag.pointer) return;
  drag.pointerY = event.clientY;
  updateDrag();
});

list.addEventListener("pointerup", endDrag);
list.addEventListener("pointercancel", endDrag);

// Moves the dragged row with the pointer and works out where it would land
function updateDrag() {
  const { item, items, tops, heights, from, slot } = drag;
  const moved = drag.pointerY + scrollY - drag.startY;
  item.style.transform = `translateY(${moved}px)`;

  // Compare the dragged row's middle with the middle of each other row
  const middle = (i) => tops[i] + heights[i] / 2;
  const center = middle(from) + moved;
  let to = from;
  for (let i = 0; i < from; i++) {
    if (center < middle(i)) {
      to = i;
      break;
    }
  }
  for (let i = from + 1; i < items.length; i++) {
    if (center > middle(i)) to = i;
  }
  drag.to = to;

  // Rows between the old and new place step aside by one slot
  items.forEach((other, i) => {
    if (other === item) return;
    let shift = 0;
    if (i > from && i <= to) shift = -slot;
    if (i < from && i >= to) shift = slot;
    other.style.transform = shift ? `translateY(${shift}px)` : "";
  });
}

// Near the top or bottom of the window, scroll so long lists can be sorted
function autoScroll() {
  if (!drag) return;
  const edge = 70;
  const y = drag.pointerY;
  let speed = 0;
  if (y < edge) speed = -(edge - y) / 4;
  if (y > innerHeight - edge) speed = (y - (innerHeight - edge)) / 4;
  if (speed) {
    scrollBy({ top: speed, behavior: "instant" });
    updateDrag();
  }
  drag.frame = requestAnimationFrame(autoScroll);
}

// Letting go: save the new order, and let every row glide into place
function endDrag(event) {
  if (!drag || event.pointerId !== drag.pointer) return;
  cancelAnimationFrame(drag.frame);
  const { item, from, to } = drag;
  const before = positions(); // Where the rows are on screen right now
  drag = null;
  list.classList.remove("is-sorting");
  item.classList.remove("is-dragging");
  for (const row of list.children) row.style.transform = "";

  const id = item.dataset.id;
  if (!moveTask(from, to, before)) render(before);
  focusTask(id, ".task-handle");
}

// ─── Filters ───

for (const button of filterButtons) {
  button.addEventListener("click", () => {
    filter = button.dataset.filter;
    commit();
  });
}

// ─── Another tab of this site changed the list: show the new version ───

addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY && !drag && !editingId) {
    tasks = load();
    render();
  }
});

render(); // Show the saved tasks when the page opens

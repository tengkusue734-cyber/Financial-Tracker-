const TASK_STORAGE_KEY = "financial-tracker-tasks-v1";
const task$ = selector => document.querySelector(selector);
const todayTaskDate = new Date().toISOString().slice(0, 10);
const statuses = ["urgent", "pending", "waiting", "complete"];
let tasks = loadTasks();
let editingTaskId = null;
let confirmDeleteTask = false;

function loadTasks() { try { return JSON.parse(localStorage.getItem(TASK_STORAGE_KEY)) || []; } catch { return []; } }
function saveTasks() { localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks)); }
function dueLabel(date) { return date ? new Intl.DateTimeFormat("ms-MY", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`)) : "—"; }
function isOverdue(task) { return task.status !== "complete" && (task.dueDate || "") < todayTaskDate; }
function subsOf(task) { return Array.isArray(task.subtasks) ? task.subtasks : []; }
function subsDone(task) { return subsOf(task).filter(sub => sub.done).length; }
function newSubId() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }
function findTask(id) { return tasks.find(item => item.id === id); }

function subRowMarkup(sub, taskId) {
  return `<div class="sub-row${sub.done ? " is-done" : ""}" data-subrow="${sub.id}">
      <label><input type="checkbox" data-sub="${sub.id}" data-task="${taskId}" ${sub.done ? "checked" : ""} /></label>
      <span class="sub-title" contenteditable="plaintext-only" role="textbox" data-subedit="${sub.id}" data-task="${taskId}"></span>
      <button type="button" class="sub-del" data-subdel="${sub.id}" data-task="${taskId}" aria-label="Buang sub-task">×</button>
    </div>`;
}

function fillSubList(container, task) {
  const subs = subsOf(task);
  container.innerHTML = subs.map(sub => subRowMarkup(sub, task.id)).join("");
  container.querySelectorAll("[data-subedit]").forEach((node, index) => { node.textContent = subs[index].title; });
}

function subtaskMarkup(task) {
  const subs = subsOf(task);
  const done = subsDone(task);
  const bar = subs.length
    ? `<div class="sub-bar"><span style="width:${((done / subs.length) * 100).toFixed(0)}%"></span></div><p class="sub-count">${done} daripada ${subs.length} sub-task siap</p>`
    : "";
  return `<div class="subtasks" data-subwrap="${task.id}">
      <div class="sub-list" data-sublist="${task.id}"></div>
      ${bar}
      <div class="sub-add-row">
        <input class="sub-add" type="text" maxlength="80" placeholder="Tambah sub-task" data-subadd="${task.id}" aria-label="Tambah sub-task" />
        <button type="button" class="sub-plus" data-subplus="${task.id}" aria-label="Tambah sub-task">+</button>
      </div>
      ${subs.length > 1 && done < subs.length ? `<button type="button" class="sub-all" data-suball="${task.id}">Tandakan semua siap</button>` : ""}
    </div>`;
}

function emptyList(container) { container.append(task$("#emptyTaskTemplate").content.cloneNode(true)); }

function renderTasks() {
  const openTasks = tasks.filter(task => task.status !== "complete");
  task$("#todayFocus").textContent = openTasks.filter(task => task.focus || task.dueDate === todayTaskDate).length;
  task$("#urgentCount").textContent = tasks.filter(task => task.status === "urgent").length;
  task$("#waitingCount").textContent = tasks.filter(task => task.status === "waiting").length;
  statuses.forEach(status => {
    const list = task$(`#${status}Tasks`); const listTasks = tasks.filter(task => task.status === status).sort((a,b) => (a.dueDate || "").localeCompare(b.dueDate || "") || b.createdAt - a.createdAt); task$(`#${status}Label`).textContent = listTasks.length; list.innerHTML = "";
    if (!listTasks.length) return emptyList(list);
    listTasks.forEach(task => {
      const card = document.createElement("article"); card.className = `task-card ${task.focus ? "is-focus" : ""} ${isOverdue(task) ? "is-overdue" : ""}`;
      const statusOptions = statuses.map(value => `<option value="${value}" ${task.status === value ? "selected" : ""}>${value[0].toUpperCase() + value.slice(1)}</option>`).join("");
      const subs = subsOf(task);
      const allDone = subs.length > 0 && subsDone(task) === subs.length;
      const subChip = subs.length ? `<span class="sub-chip${allDone ? " is-done" : ""}">${subsDone(task)}/${subs.length}</span>` : "";
      card.innerHTML = `<div class="task-card-top"><span class="task-marker">${task.focus ? "★ Fokus hari ini" : isOverdue(task) ? "Lewat" : `Sebelum ${dueLabel(task.dueDate)}`}</span><span class="row-actions">${subChip}<select class="task-status-select" data-id="${task.id}" aria-label="Tukar status">${statusOptions}</select><button class="edit-button" type="button" data-edit-task="${task.id}" aria-label="Edit task">✎</button></span></div><h3></h3><p class="task-note"></p>${subtaskMarkup(task)}${allDone && task.status !== "complete" ? `<p class="sub-hint">Semua sub-task siap — tukar status kepada Complete?</p>` : ""}<div class="task-card-bottom"><span>Tarikh akhir: ${dueLabel(task.dueDate)}</span><label class="small-focus"><input type="checkbox" data-focus-id="${task.id}" ${task.focus ? "checked" : ""} /> Fokus</label></div>`;
      card.querySelector("h3").textContent = task.title;
      card.querySelector(".task-note").textContent = task.note || "Tiada nota";
      card.dataset.card = task.id;
      fillSubList(card.querySelector(".sub-list"), task);
      list.append(card);
    });
  });
}

task$("#taskDueDate").value = todayTaskDate;
task$("#taskForm").addEventListener("submit", event => { event.preventDefault(); tasks.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), title: task$("#taskTitle").value.trim(), status: task$("#taskStatus").value, dueDate: task$("#taskDueDate").value, focus: task$("#taskFocus").checked, note: task$("#taskNote").value.trim(), createdAt: Date.now() }); saveTasks(); event.target.reset(); task$("#taskDueDate").value = todayTaskDate; renderTasks(); });
task$(".task-board").addEventListener("change", event => {
  const subBox = event.target.closest("[data-sub]");
  if (subBox) {
    const task = findTask(subBox.dataset.task);
    const sub = task && subsOf(task).find(item => item.id === subBox.dataset.sub);
    if (sub) { sub.done = subBox.checked; saveTasks(); refreshSubtasks(task.id, { keepFocus: false }); }
    return;
  } const statusControl = event.target.closest("[data-id]"); const focusControl = event.target.closest("[data-focus-id]"); if (statusControl) { const task = tasks.find(item => item.id === statusControl.dataset.id); if (task) { task.status = statusControl.value; if (task.status === "complete") task.focus = false; saveTasks(); renderTasks(); } } if (focusControl) { const task = tasks.find(item => item.id === focusControl.dataset.focusId); if (task) { task.focus = focusControl.checked; saveTasks(); renderTasks(); } } });

/* ---------- Sub-task ---------- */
function refreshSubtasks(taskId, options) {
  const keepFocus = !options || options.keepFocus !== false;
  const task = findTask(taskId);
  const card = document.querySelector(`[data-card="${taskId}"]`);
  if (!task || !card) { renderTasks(); return; }
  const subs = subsOf(task);
  const done = subsDone(task);

  fillSubList(card.querySelector(".sub-list"), task);

  const wrap = card.querySelector(".subtasks");
  let bar = wrap.querySelector(".sub-bar");
  let count = wrap.querySelector(".sub-count");
  if (subs.length && !bar) {
    wrap.querySelector(".sub-list").insertAdjacentHTML("afterend", '<div class="sub-bar"><span></span></div><p class="sub-count"></p>');
    bar = wrap.querySelector(".sub-bar"); count = wrap.querySelector(".sub-count");
  }
  if (!subs.length && bar) { bar.remove(); if (count) count.remove(); }
  if (subs.length && bar) {
    bar.querySelector("span").style.width = `${((done / subs.length) * 100).toFixed(0)}%`;
    count.textContent = `${done} daripada ${subs.length} sub-task siap`;
  }

  const chipHolder = card.querySelector(".row-actions");
  let chip = chipHolder.querySelector(".sub-chip");
  if (subs.length && !chip) { chipHolder.insertAdjacentHTML("afterbegin", '<span class="sub-chip"></span>'); chip = chipHolder.querySelector(".sub-chip"); }
  if (!subs.length && chip) chip.remove();
  if (chip) { chip.textContent = `${done}/${subs.length}`; chip.classList.toggle("is-done", done === subs.length); }

  const allDone = subs.length > 0 && done === subs.length;
  const hint = card.querySelector(".sub-hint");
  if (allDone && task.status !== "complete" && !hint) wrap.insertAdjacentHTML("afterend", '<p class="sub-hint">Semua sub-task siap — tukar status kepada Complete bila kau sedia.</p>');
  if ((!allDone || task.status === "complete") && hint) hint.remove();

  const all = wrap.querySelector(".sub-all");
  if (subs.length > 1 && !allDone && !all) wrap.insertAdjacentHTML("beforeend", `<button type="button" class="sub-all" data-suball="${taskId}">Tandakan semua siap</button>`);
  if ((subs.length <= 1 || allDone) && all) all.remove();

  if (keepFocus) {
    const input = card.querySelector(`[data-subadd="${taskId}"]`);
    if (input && document.activeElement !== input) input.focus();
  }
}

function addSubtask(taskId) {
  const input = document.querySelector(`[data-subadd="${taskId}"]`);
  const task = findTask(taskId);
  const title = input ? input.value.trim() : "";
  if (!task || !title) { if (input) input.focus(); return; }
  if (!Array.isArray(task.subtasks)) task.subtasks = [];
  task.subtasks.push({ id: newSubId(), title, done: false });
  saveTasks();
  input.value = "";
  refreshSubtasks(taskId);
}

task$(".task-board").addEventListener("keydown", event => {
  const input = event.target.closest("[data-subadd]");
  if (input && event.key === "Enter") { event.preventDefault(); addSubtask(input.dataset.subadd); return; }
  const editing = event.target.closest("[data-subedit]");
  if (editing && event.key === "Enter") { event.preventDefault(); editing.blur(); }
});
task$(".task-board").addEventListener("click", event => {
  const plus = event.target.closest("[data-subplus]");
  if (plus) { addSubtask(plus.dataset.subplus); return; }
  const all = event.target.closest("[data-suball]");
  if (all) {
    const task = findTask(all.dataset.suball);
    if (task) { subsOf(task).forEach(sub => { sub.done = true; }); saveTasks(); refreshSubtasks(task.id, { keepFocus: false }); }
    return;
  }
  const button = event.target.closest("[data-subdel]");
  if (!button) return;
  const task = findTask(button.dataset.task);
  if (!task) return;
  task.subtasks = subsOf(task).filter(sub => sub.id !== button.dataset.subdel);
  saveTasks();
  refreshSubtasks(task.id, { keepFocus: false });
});

/* Tukar nama sub-task terus pada teksnya */
task$(".task-board").addEventListener("focusout", event => {
  const node = event.target.closest("[data-subedit]");
  if (!node) return;
  const task = findTask(node.dataset.task);
  const sub = task && subsOf(task).find(item => item.id === node.dataset.subedit);
  if (!sub) return;
  const title = node.textContent.trim().replace(/\s+/g, " ");
  if (!title) { node.textContent = sub.title; return; }
  if (title === sub.title) return;
  sub.title = title.slice(0, 80);
  saveTasks();
});

/* ---------- Edit task ---------- */
task$(".task-board").addEventListener("click", event => {
  const button = event.target.closest("[data-edit-task]");
  if (!button) return;
  const task = tasks.find(item => item.id === button.dataset.editTask);
  if (!task) return;
  editingTaskId = task.id; confirmDeleteTask = false;
  task$("#editTaskTitle").value = task.title || "";
  task$("#editTaskStatus").value = task.status || "pending";
  task$("#editTaskDue").value = task.dueDate || todayTaskDate;
  task$("#editTaskNote").value = task.note || "";
  task$("#editTaskFocus").checked = !!task.focus;
  task$("#deleteTask").textContent = "Padam task";
  task$("#taskDialog").showModal(); task$("#editTaskTitle").focus();
});
task$("#closeTaskEdit").addEventListener("click", () => task$("#taskDialog").close());
task$("#taskEditForm").addEventListener("submit", event => {
  event.preventDefault();
  const task = tasks.find(item => item.id === editingTaskId);
  const title = task$("#editTaskTitle").value.trim();
  if (!task || !title) return;
  task.title = title;
  task.status = task$("#editTaskStatus").value;
  task.dueDate = task$("#editTaskDue").value;
  task.note = task$("#editTaskNote").value.trim();
  task.focus = task$("#editTaskFocus").checked && task.status !== "complete";
  saveTasks(); task$("#taskDialog").close(); editingTaskId = null; renderTasks();
});
task$("#deleteTask").addEventListener("click", () => {
  if (!editingTaskId) return;
  if (!confirmDeleteTask) { confirmDeleteTask = true; task$("#deleteTask").textContent = "Tekan sekali lagi untuk padam"; return; }
  tasks = tasks.filter(item => item.id !== editingTaskId);
  saveTasks(); task$("#taskDialog").close(); editingTaskId = null; confirmDeleteTask = false; renderTasks();
});

document.addEventListener("ft-cloud-data", () => { tasks = loadTasks(); renderTasks(); });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
renderTasks();

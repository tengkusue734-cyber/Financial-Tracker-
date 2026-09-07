const TASK_STORAGE_KEY = "financial-tracker-tasks-v1";
const task$ = selector => document.querySelector(selector);
const todayTaskDate = new Date().toISOString().slice(0, 10);
const statuses = ["urgent", "pending", "waiting", "complete"];
let tasks = loadTasks();

function loadTasks() { try { return JSON.parse(localStorage.getItem(TASK_STORAGE_KEY)) || []; } catch { return []; } }
function saveTasks() { localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks)); }
function dueLabel(date) { return new Intl.DateTimeFormat("ms-MY", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`)); }
function isOverdue(task) { return task.status !== "complete" && task.dueDate < todayTaskDate; }
function emptyList(container) { container.append(task$("#emptyTaskTemplate").content.cloneNode(true)); }

function renderTasks() {
  const openTasks = tasks.filter(task => task.status !== "complete");
  task$("#todayFocus").textContent = openTasks.filter(task => task.focus || task.dueDate === todayTaskDate).length;
  task$("#urgentCount").textContent = tasks.filter(task => task.status === "urgent").length;
  task$("#waitingCount").textContent = tasks.filter(task => task.status === "waiting").length;
  statuses.forEach(status => {
    const list = task$(`#${status}Tasks`); const listTasks = tasks.filter(task => task.status === status).sort((a,b) => a.dueDate.localeCompare(b.dueDate) || b.createdAt - a.createdAt); task$(`#${status}Label`).textContent = listTasks.length; list.innerHTML = "";
    if (!listTasks.length) return emptyList(list);
    listTasks.forEach(task => {
      const card = document.createElement("article"); card.className = `task-card ${task.focus ? "is-focus" : ""} ${isOverdue(task) ? "is-overdue" : ""}`;
      const statusOptions = statuses.map(value => `<option value="${value}" ${task.status === value ? "selected" : ""}>${value[0].toUpperCase() + value.slice(1)}</option>`).join("");
      card.innerHTML = `<div class="task-card-top"><span class="task-marker">${task.focus ? "★ Fokus hari ini" : isOverdue(task) ? "Lewat" : `Sebelum ${dueLabel(task.dueDate)}`}</span><select class="task-status-select" data-id="${task.id}" aria-label="Tukar status">${statusOptions}</select></div><h3></h3><p class="task-note"></p><div class="task-card-bottom"><span>Tarikh akhir: ${dueLabel(task.dueDate)}</span><label class="small-focus"><input type="checkbox" data-focus-id="${task.id}" ${task.focus ? "checked" : ""} /> Fokus</label></div>`;
      card.querySelector("h3").textContent = task.title; card.querySelector(".task-note").textContent = task.note || "Tiada nota"; list.append(card);
    });
  });
}

task$("#taskDueDate").value = todayTaskDate;
task$("#taskForm").addEventListener("submit", event => { event.preventDefault(); tasks.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), title: task$("#taskTitle").value.trim(), status: task$("#taskStatus").value, dueDate: task$("#taskDueDate").value, focus: task$("#taskFocus").checked, note: task$("#taskNote").value.trim(), createdAt: Date.now() }); saveTasks(); event.target.reset(); task$("#taskDueDate").value = todayTaskDate; renderTasks(); });
task$(".task-board").addEventListener("change", event => { const statusControl = event.target.closest("[data-id]"); const focusControl = event.target.closest("[data-focus-id]"); if (statusControl) { const task = tasks.find(item => item.id === statusControl.dataset.id); if (task) { task.status = statusControl.value; if (task.status === "complete") task.focus = false; saveTasks(); renderTasks(); } } if (focusControl) { const task = tasks.find(item => item.id === focusControl.dataset.focusId); if (task) { task.focus = focusControl.checked; saveTasks(); renderTasks(); } } });
document.addEventListener("ft-cloud-data", () => { tasks = loadTasks(); renderTasks(); });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
renderTasks();

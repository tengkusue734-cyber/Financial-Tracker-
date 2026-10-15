/* ==========================================================================
   Timeline projek (Gantt) untuk Financial Tracker
   PENTING: fail ini guna kunci penyimpanan SENDIRI.
   Ia tidak membaca, menulis atau memadam data To-Do, transaksi, simpanan
   atau hutang yang sedia ada.
   ========================================================================== */

const TL_KEY = "financial-tracker-projects-v1";      // kunci baharu
const TL_UI_KEY = "financial-tracker-ui-timeline-v1"; // pilihan paparan sahaja
const TL_TASKS_KEY = "financial-tracker-tasks-v1";    // dibaca sahaja (untuk import)

const tl$ = selector => document.querySelector(selector);
const DAYMS = 86400000;
const DAY_W = { day: 38, week: 13 };
const DAY_W_SMALL = { day: 30, week: 11 };
function dayWidth() { return (window.innerWidth < 560 ? DAY_W_SMALL : DAY_W)[zoom]; }
const ROW_H = 44;
const MS_MONTH = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];

/* ---------- Tarikh ---------- */
function tlParse(value) { const [y, m, d] = String(value).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); }
function tlIso(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function tlToday() { return tlIso(new Date()); }
function tlAdd(value, days) { const d = tlParse(value); d.setDate(d.getDate() + days); return tlIso(d); }
function tlDiff(from, to) { return Math.round((tlParse(to) - tlParse(from)) / DAYMS); }
function tlLabel(value) { const d = tlParse(value); return `${d.getDate()} ${MS_MONTH[d.getMonth()]}`; }
function tlNewId() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }
function tlClampOrder(start, end) { return tlDiff(start, end) < 0 ? [end, start] : [start, end]; }

/* ---------- Simpanan ---------- */
function loadProjects() { try { const v = JSON.parse(localStorage.getItem(TL_KEY)); return Array.isArray(v) ? v : []; } catch { return []; } }
function saveProjects() { localStorage.setItem(TL_KEY, JSON.stringify(projects)); }
function loadTlUi() { try { return JSON.parse(localStorage.getItem(TL_UI_KEY)) || {}; } catch { return {}; } }
function saveTlUi() { try { localStorage.setItem(TL_UI_KEY, JSON.stringify({ view, zoom, activeId })); } catch { /* abaikan */ } }

let projects = loadProjects();
const savedUi = loadTlUi();
let view = savedUi.view === "timeline" ? "timeline" : "board";
let zoom = savedUi.zoom === "week" ? "week" : "day";
let activeId = savedUi.activeId || "";
let editing = null;   // { kind:"task"|"sub", taskId, subId, isNew }
let confirmTlDelete = false;
let confirmProjectDelete = false;
let scrolledFor = "";

/* ---------- Pembantu model ---------- */
function activeProject() {
  if (!projects.length) return null;
  return projects.find(p => p.id === activeId) || projects[0];
}
function tasksOf(project) { return Array.isArray(project && project.tasks) ? project.tasks : []; }
function subsOfTl(task) { return Array.isArray(task && task.subtasks) ? task.subtasks : []; }
function findTlTask(id) { const p = activeProject(); return p ? tasksOf(p).find(t => t.id === id) : null; }
function findTlSub(taskId, subId) { const t = findTlTask(taskId); return t ? subsOfTl(t).find(s => s.id === subId) : null; }
function taskProgress(task) {
  const subs = subsOfTl(task);
  if (!subs.length) return task.done ? 100 : 0;
  return Math.round((subs.filter(s => s.done).length / subs.length) * 100);
}

/* ---------- Julat tarikh yang dipaparkan ---------- */
function timelineRange(project) {
  const dates = [];
  tasksOf(project).forEach(task => {
    dates.push(task.start, task.end);
    subsOfTl(task).forEach(sub => dates.push(sub.start, sub.end));
  });
  dates.push(tlToday());
  const clean = dates.filter(Boolean).sort();
  let first = tlAdd(clean[0], -3);
  let last = tlAdd(clean[clean.length - 1], 6);
  if (tlDiff(first, last) < 24) last = tlAdd(first, 24);
  return { first, last, total: tlDiff(first, last) + 1 };
}

/* ==========================================================================
   Paparan
   ========================================================================== */
function renderProjectChips() {
  const holder = tl$("#tlProjects");
  const current = activeProject();
  holder.innerHTML = "";
  projects.forEach(project => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `tl-chip${current && project.id === current.id ? " active" : ""}`;
    chip.dataset.project = project.id;
    chip.textContent = project.name || "Projek";
    holder.append(chip);
  });
  tl$("#tlRenameProject").hidden = !current;
}

function headMarkup(range, width) {
  const months = [];
  for (let i = 0; i < range.total; i += 1) {
    const date = tlParse(tlAdd(range.first, i));
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const last = months[months.length - 1];
    if (last && last.key === key) last.count += 1;
    else months.push({ key, count: 1, label: `${MS_MONTH[date.getMonth()]} ${date.getFullYear()}` });
  }
  const monthRow = months.map(month =>
    `<span class="tl-month" style="width:${month.count * width}px"><i>${month.label}</i></span>`).join("");

  let dayRow = "";
  for (let i = 0; i < range.total; i += 1) {
    const value = tlAdd(range.first, i);
    const date = tlParse(value);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    if (zoom === "day") {
      dayRow += `<span class="tl-day${weekend ? " is-weekend" : ""}" style="width:${width}px">${date.getDate()}</span>`;
    } else {
      const showLabel = date.getDay() === 1;
      dayRow += `<span class="tl-day tl-day-week" style="width:${width}px">${showLabel ? date.getDate() : ""}</span>`;
    }
  }
  return `<div class="tl-months">${monthRow}</div><div class="tl-days">${dayRow}</div>`;
}

function weekendMarkup(range, width) {
  if (zoom !== "day") return "";
  let out = "";
  for (let i = 0; i < range.total; i += 1) {
    const date = tlParse(tlAdd(range.first, i));
    if (date.getDay() === 0 || date.getDay() === 6) {
      out += `<div class="tl-weekend" style="left:${i * width}px;width:${width}px"></div>`;
    }
  }
  return out;
}

function barMarkup(item, range, width, kind) {
  const [start, end] = tlClampOrder(item.start, item.end);
  const offset = tlDiff(range.first, start);
  const span = Math.max(1, tlDiff(start, end) + 1);
  const done = kind === "task" ? taskProgress(item) : (item.done ? 100 : 0);
  const ref = kind === "task" ? `task:${item.id}` : `sub:${item.parentId}:${item.id}`;
  return `<div class="tl-bar tl-bar-${kind}${item.done ? " is-done" : ""}" data-bar="${ref}"
      style="left:${offset * width}px;width:${span * width}px" title="${tlLabel(start)} – ${tlLabel(end)}">
      <span class="tl-fill" style="width:${done}%"></span>
      <span class="tl-grip tl-grip-start" data-grip="start" aria-hidden="true"></span>
      <b class="tl-bar-text"></b>
      <span class="tl-grip tl-grip-end" data-grip="end" aria-hidden="true"></span>
    </div>`;
}

function renderTimeline() {
  const project = activeProject();
  const empty = tl$("#tlEmpty");
  const wrap = tl$("#tlWrap");
  const hint = tl$("#tlHint");

  if (!project) {
    wrap.hidden = true; hint.hidden = true; empty.hidden = false;
    tl$("#tlAddTask").hidden = true;
    renderProjectChips();
    return;
  }
  activeId = project.id;
  empty.hidden = true; wrap.hidden = false; hint.hidden = false;
  tl$("#tlAddTask").hidden = false;
  renderProjectChips();

  const width = dayWidth();
  const range = timelineRange(project);
  const canvasWidth = range.total * width;
  const tasks = tasksOf(project).slice().sort((a, b) => String(a.start).localeCompare(String(b.start)));

  /* ----- lajur kiri ----- */
  const side = tl$("#tlSide");
  side.innerHTML = `<div class="tl-side-head"><span>Tugasan</span><span class="tl-count">${tasks.length}</span></div>`;
  const lanes = [];

  tasks.forEach(task => {
    const subs = subsOfTl(task);
    const row = document.createElement("div");
    row.className = `tl-row tl-row-task${task.done ? " is-done" : ""}`;
    row.innerHTML = `<button type="button" class="tl-caret${task.collapsed ? " is-closed" : ""}" data-collapse="${task.id}"
          aria-label="Buka atau tutup sub-task">${subs.length ? (task.collapsed ? "▸" : "▾") : "•"}</button>
        <span class="tl-name"></span>
        <span class="tl-row-tools">
          <span class="tl-sub-count">${subs.length ? `${subs.filter(s => s.done).length}/${subs.length}` : ""}</span>
          <button type="button" class="tl-mini" data-add-sub="${task.id}" aria-label="Tambah sub-task">+</button>
          <button type="button" class="tl-mini" data-edit-task="${task.id}" aria-label="Edit tugasan">✎</button>
        </span>`;
    row.querySelector(".tl-name").textContent = task.title || "Tanpa nama";
    side.append(row);
    lanes.push({ kind: "task", item: task });

    if (!task.collapsed) {
      subs.forEach(sub => {
        const subRow = document.createElement("div");
        subRow.className = `tl-row tl-row-sub${sub.done ? " is-done" : ""}`;
        subRow.innerHTML = `<label class="tl-check"><input type="checkbox" data-sub-done="${sub.id}" data-task="${task.id}" ${sub.done ? "checked" : ""} /></label>
            <span class="tl-name"></span>
            <span class="tl-row-tools"><button type="button" class="tl-mini" data-edit-sub="${sub.id}" data-task="${task.id}" aria-label="Edit sub-task">✎</button></span>`;
        subRow.querySelector(".tl-name").textContent = sub.title || "Sub-task";
        side.append(subRow);
        lanes.push({ kind: "sub", item: { ...sub, parentId: task.id } });
      });
    }
  });

  if (!tasks.length) {
    const row = document.createElement("div");
    row.className = "tl-row tl-row-empty";
    row.textContent = "Belum ada tugasan";
    side.append(row);
  }

  /* ----- kanvas kanan ----- */
  const canvas = tl$("#tlCanvas");
  const todayOffset = tlDiff(range.first, tlToday());
  const todayLine = todayOffset >= 0 && todayOffset < range.total
    ? `<div class="tl-today" style="left:${todayOffset * width + width / 2}px"></div>` : "";

  canvas.style.width = `${canvasWidth}px`;
  canvas.style.setProperty("--tl-day", `${width}px`);
  canvas.innerHTML = `<div class="tl-head">${headMarkup(range, width)}</div>
      <div class="tl-rows">
        ${weekendMarkup(range, width)}
        ${todayLine}
        ${lanes.map(lane => `<div class="tl-lane tl-lane-${lane.kind}">${barMarkup(lane.item, range, width, lane.kind)}</div>`).join("")}
        ${lanes.length ? "" : '<div class="tl-lane"></div>'}
      </div>`;

  if (scrolledFor !== project.id) {
    scrolledFor = project.id;
    const scroller = tl$("#tlScroll");
    const target = Math.max(0, (todayOffset - 2) * width);
    requestAnimationFrame(() => { scroller.scrollLeft = target; });
  }

  canvas.querySelectorAll(".tl-lane").forEach((lane, index) => {
    const info = lanes[index];
    const text = lane.querySelector(".tl-bar-text");
    if (info && text) text.textContent = info.item.title || (info.kind === "task" ? "Tanpa nama" : "Sub-task");
  });
}

/* ==========================================================================
   Seret bar (tetikus, sentuhan dan pen)
   ========================================================================== */
let drag = null;

function barRef(bar) {
  const parts = bar.dataset.bar.split(":");
  if (parts[0] === "task") return { kind: "task", taskId: parts[1] };
  return { kind: "sub", taskId: parts[1], subId: parts[2] };
}

function startDrag(event) {
  const bar = event.target.closest(".tl-bar");
  if (!bar) return;
  const grip = event.target.closest("[data-grip]");
  const ref = barRef(bar);
  const record = ref.kind === "task" ? findTlTask(ref.taskId) : findTlSub(ref.taskId, ref.subId);
  if (!record) return;

  drag = {
    bar, ref, record,
    mode: grip ? grip.dataset.grip : "move",
    startX: event.clientX,
    left: parseFloat(bar.style.left) || 0,
    width: parseFloat(bar.style.width) || dayWidth(),
    origStart: record.start,
    origEnd: record.end,
    moved: false
  };
  bar.classList.add("is-dragging");
  try { bar.setPointerCapture(event.pointerId); } catch { /* abaikan */ }
  event.preventDefault();
}

function moveDrag(event) {
  if (!drag) return;
  const width = dayWidth();
  const steps = Math.round((event.clientX - drag.startX) / width);
  if (steps !== 0) drag.moved = true;
  if (drag.mode === "move") {
    drag.bar.style.left = `${drag.left + steps * width}px`;
  } else if (drag.mode === "start") {
    const maxSteps = Math.floor(drag.width / width) - 1;
    const applied = Math.min(steps, maxSteps);
    drag.bar.style.left = `${drag.left + applied * width}px`;
    drag.bar.style.width = `${drag.width - applied * width}px`;
  } else {
    const minSteps = 1 - Math.floor(drag.width / width);
    const applied = Math.max(steps, minSteps);
    drag.bar.style.width = `${drag.width + applied * width}px`;
  }
}

function endDrag(event) {
  if (!drag) return;
  const current = drag;
  drag = null;
  current.bar.classList.remove("is-dragging");
  if (!current.moved) return;

  const width = dayWidth();
  const steps = Math.round((event.clientX - current.startX) / width);
  const record = current.record;

  if (current.mode === "move") {
    const shifted = steps;
    record.start = tlAdd(current.origStart, shifted);
    record.end = tlAdd(current.origEnd, shifted);
    if (current.ref.kind === "task") {
      subsOfTl(record).forEach(sub => {
        sub.start = tlAdd(sub.start, shifted);
        sub.end = tlAdd(sub.end, shifted);
      });
    }
  } else if (current.mode === "start") {
    const next = tlAdd(current.origStart, steps);
    record.start = tlDiff(next, record.end) < 0 ? record.end : next;
  } else {
    const next = tlAdd(current.origEnd, steps);
    record.end = tlDiff(record.start, next) < 0 ? record.start : next;
  }

  saveProjects();
  const keep = tl$("#tlScroll").scrollLeft;
  renderTimeline();
  tl$("#tlScroll").scrollLeft = keep;
}

/* ==========================================================================
   Dialog
   ========================================================================== */
function openItemDialog(options) {
  editing = options;
  confirmTlDelete = false;
  const isTask = options.kind === "task";
  tl$("#tlDialogEyebrow").textContent = isTask ? "MAIN TASK" : "SUB-TASK";
  tl$("#tlDialogTitle").textContent = options.isNew
    ? (isTask ? "Tambah main task" : "Tambah sub-task")
    : (isTask ? "Edit main task" : "Edit sub-task");
  tl$("#tlTitle").value = options.values.title || "";
  tl$("#tlStart").value = options.values.start;
  tl$("#tlEnd").value = options.values.end;
  tl$("#tlDone").checked = !!options.values.done;
  tl$("#tlDelete").hidden = !!options.isNew;
  tl$("#tlDelete").textContent = isTask ? "Padam main task" : "Padam sub-task";
  tl$("#tlDialog").showModal();
  tl$("#tlTitle").focus();
}

function saveItemDialog(event) {
  event.preventDefault();
  if (!editing) return;
  const project = activeProject();
  if (!project) return;
  const title = tl$("#tlTitle").value.trim();
  if (!title) return;
  let [start, end] = tlClampOrder(tl$("#tlStart").value || tlToday(), tl$("#tlEnd").value || tlToday());
  const done = tl$("#tlDone").checked;

  if (editing.kind === "task") {
    if (editing.isNew) {
      if (!Array.isArray(project.tasks)) project.tasks = [];
      project.tasks.push({ id: tlNewId(), title, start, end, done, collapsed: false, subtasks: [], createdAt: Date.now() });
    } else {
      const task = findTlTask(editing.taskId);
      if (!task) return;
      Object.assign(task, { title, start, end, done });
    }
  } else {
    const task = findTlTask(editing.taskId);
    if (!task) return;
    if (!Array.isArray(task.subtasks)) task.subtasks = [];
    if (editing.isNew) task.subtasks.push({ id: tlNewId(), title, start, end, done });
    else {
      const sub = findTlSub(editing.taskId, editing.subId);
      if (!sub) return;
      Object.assign(sub, { title, start, end, done });
    }
  }
  saveProjects();
  editing = null;
  tl$("#tlDialog").close();
  renderTimeline();
}

function deleteItem() {
  if (!editing || editing.isNew) return;
  if (!confirmTlDelete) {
    confirmTlDelete = true;
    tl$("#tlDelete").textContent = "Tekan sekali lagi untuk padam";
    return;
  }
  const project = activeProject();
  if (!project) return;
  if (editing.kind === "task") {
    project.tasks = tasksOf(project).filter(task => task.id !== editing.taskId);
  } else {
    const task = findTlTask(editing.taskId);
    if (task) task.subtasks = subsOfTl(task).filter(sub => sub.id !== editing.subId);
  }
  saveProjects();
  editing = null;
  confirmTlDelete = false;
  tl$("#tlDialog").close();
  renderTimeline();
}

function openProjectDialog(mode) {
  confirmProjectDelete = false;
  const current = activeProject();
  tl$("#tlProjectDialog").dataset.mode = mode;
  tl$("#tlProjectHeading").textContent = mode === "new" ? "Projek baharu" : "Nama projek";
  tl$("#tlProjectName").value = mode === "new" ? "" : (current ? current.name : "");
  tl$("#tlProjectDelete").hidden = mode === "new" || !current;
  tl$("#tlProjectDelete").textContent = "Padam projek ini";
  tl$("#tlProjectDialog").showModal();
  tl$("#tlProjectName").focus();
}

function saveProjectDialog(event) {
  event.preventDefault();
  const name = tl$("#tlProjectName").value.trim();
  if (!name) return;
  if (tl$("#tlProjectDialog").dataset.mode === "new") {
    const project = { id: tlNewId(), name, createdAt: Date.now(), tasks: [] };
    projects.push(project);
    activeId = project.id;
  } else {
    const current = activeProject();
    if (current) current.name = name;
  }
  saveProjects();
  saveTlUi();
  tl$("#tlProjectDialog").close();
  renderTimeline();
}

function deleteProject() {
  const current = activeProject();
  if (!current) return;
  if (!confirmProjectDelete) {
    confirmProjectDelete = true;
    tl$("#tlProjectDelete").textContent = "Tekan sekali lagi untuk padam";
    return;
  }
  projects = projects.filter(project => project.id !== current.id);
  activeId = projects.length ? projects[0].id : "";
  confirmProjectDelete = false;
  saveProjects();
  saveTlUi();
  tl$("#tlProjectDialog").close();
  renderTimeline();
}

/* ---------- Salin daripada To-Do (baca sahaja, tidak ubah data To-Do) ---------- */
function importFromTodo() {
  let source = [];
  try { source = JSON.parse(localStorage.getItem(TL_TASKS_KEY)) || []; } catch { source = []; }
  const open = source.filter(task => task && task.status !== "complete");
  if (!open.length) {
    tl$("#tlEmptyNote").textContent = "Tiada task aktif dalam To-Do untuk disalin.";
    return;
  }
  const project = {
    id: tlNewId(),
    name: "Dari To-Do",
    createdAt: Date.now(),
    tasks: open.map(task => {
      const end = task.dueDate || tlToday();
      const start = tlAdd(end, -4);
      const subs = Array.isArray(task.subtasks) ? task.subtasks : [];
      const step = subs.length ? Math.max(1, Math.floor(5 / subs.length)) : 1;
      return {
        id: tlNewId(),
        title: task.title || "Tanpa nama",
        start, end,
        done: false,
        collapsed: false,
        createdAt: Date.now(),
        subtasks: subs.map((sub, index) => ({
          id: tlNewId(),
          title: sub.title || "Sub-task",
          start: tlAdd(start, index * step),
          end: tlAdd(start, index * step + step - 1),
          done: !!sub.done
        }))
      };
    })
  };
  projects.push(project);
  activeId = project.id;
  saveProjects();
  saveTlUi();
  renderTimeline();
}

/* ==========================================================================
   Tukar paparan papan / timeline
   ========================================================================== */
function applyView() {
  const boardParts = [".task-overview", ".task-form-section", ".task-board"];
  boardParts.forEach(selector => {
    const node = document.querySelector(selector);
    if (node) node.hidden = view === "timeline";
  });
  tl$("#timelineView").hidden = view !== "timeline";
  document.querySelectorAll("[data-view]").forEach(button => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  if (view === "timeline") renderTimeline();
}

/* ==========================================================================
   Pendengar
   ========================================================================== */
document.querySelectorAll("[data-view]").forEach(button => {
  button.addEventListener("click", () => { view = button.dataset.view; saveTlUi(); applyView(); });
});

tl$(".tl-zoom").addEventListener("click", event => {
  const button = event.target.closest("[data-zoom]");
  if (!button) return;
  zoom = button.dataset.zoom;
  document.querySelectorAll("[data-zoom]").forEach(other => other.classList.toggle("active", other === button));
  saveTlUi();
  renderTimeline();
});

tl$("#tlProjects").addEventListener("click", event => {
  const chip = event.target.closest("[data-project]");
  if (!chip) return;
  activeId = chip.dataset.project;
  saveTlUi();
  renderTimeline();
});

tl$("#tlNewProject").addEventListener("click", () => openProjectDialog("new"));
tl$("#tlEmptyNew").addEventListener("click", () => openProjectDialog("new"));
tl$("#tlEmptyImport").addEventListener("click", importFromTodo);
tl$("#tlRenameProject").addEventListener("click", () => openProjectDialog("edit"));
tl$("#tlAddTask").addEventListener("click", () => {
  if (!activeProject()) return;
  openItemDialog({ kind: "task", isNew: true, values: { title: "", start: tlToday(), end: tlAdd(tlToday(), 4), done: false } });
});

tl$("#tlSide").addEventListener("click", event => {
  const collapse = event.target.closest("[data-collapse]");
  if (collapse) {
    const task = findTlTask(collapse.dataset.collapse);
    if (task && subsOfTl(task).length) { task.collapsed = !task.collapsed; saveProjects(); renderTimeline(); }
    return;
  }
  const addSub = event.target.closest("[data-add-sub]");
  if (addSub) {
    const task = findTlTask(addSub.dataset.addSub);
    if (!task) return;
    openItemDialog({ kind: "sub", taskId: task.id, isNew: true, values: { title: "", start: task.start, end: task.end, done: false } });
    return;
  }
  const editTask = event.target.closest("[data-edit-task]");
  if (editTask) {
    const task = findTlTask(editTask.dataset.editTask);
    if (task) openItemDialog({ kind: "task", taskId: task.id, values: task });
    return;
  }
  const editSub = event.target.closest("[data-edit-sub]");
  if (editSub) {
    const sub = findTlSub(editSub.dataset.task, editSub.dataset.editSub);
    if (sub) openItemDialog({ kind: "sub", taskId: editSub.dataset.task, subId: sub.id, values: sub });
  }
});

tl$("#tlSide").addEventListener("change", event => {
  const box = event.target.closest("[data-sub-done]");
  if (!box) return;
  const sub = findTlSub(box.dataset.task, box.dataset.subDone);
  if (!sub) return;
  sub.done = box.checked;
  saveProjects();
  renderTimeline();
});

const canvasHost = tl$("#tlCanvas");
canvasHost.addEventListener("pointerdown", startDrag);
canvasHost.addEventListener("pointermove", moveDrag);
canvasHost.addEventListener("pointerup", endDrag);
canvasHost.addEventListener("pointercancel", () => {
  if (!drag) return;
  drag.bar.classList.remove("is-dragging");
  drag = null;
  renderTimeline();
});
canvasHost.addEventListener("dblclick", event => {
  const bar = event.target.closest(".tl-bar");
  if (!bar) return;
  const ref = barRef(bar);
  if (ref.kind === "task") {
    const task = findTlTask(ref.taskId);
    if (task) openItemDialog({ kind: "task", taskId: task.id, values: task });
  } else {
    const sub = findTlSub(ref.taskId, ref.subId);
    if (sub) openItemDialog({ kind: "sub", taskId: ref.taskId, subId: sub.id, values: sub });
  }
});

tl$("#tlForm").addEventListener("submit", saveItemDialog);
tl$("#tlDelete").addEventListener("click", deleteItem);
tl$("#tlClose").addEventListener("click", () => { editing = null; tl$("#tlDialog").close(); });
tl$("#tlProjectForm").addEventListener("submit", saveProjectDialog);
tl$("#tlProjectDelete").addEventListener("click", deleteProject);
tl$("#tlProjectClose").addEventListener("click", () => tl$("#tlProjectDialog").close());

document.addEventListener("ft-cloud-data", event => {
  if (event.detail && event.detail.name && event.detail.name !== "projects") return;
  projects = loadProjects();
  if (view === "timeline") renderTimeline();
});

window.addEventListener("resize", () => { if (view === "timeline") renderTimeline(); });

applyView();

/* ==========================================================================
   Isu & cadangan penyelesaian bagi setiap task
   PENTING: fail ini guna kunci penyimpanan SENDIRI
   (financial-tracker-issues-v1). Ia hanya MEMBACA senarai task sedia ada
   untuk tahu nama task. Task hanya ditulis bila kau sendiri tekan
   "Jadikan task" pada cadangan yang dipilih.
   ========================================================================== */

const ISSUE_KEY = "financial-tracker-issues-v1";
const ISSUE_UI_KEY = "financial-tracker-ui-issues-v1";
const ISSUE_TASKS_KEY = "financial-tracker-tasks-v1";
const ISSUE_VIEW_KEY = "financial-tracker-ui-timeline-v1"; // paparan dikongsi dengan timeline

const is$ = selector => document.querySelector(selector);
const ISSUE_MONTH = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];

const PARTY_TYPES = [
  { value: "orang", label: "Orang" },
  { value: "pelanggan", label: "Pelanggan" },
  { value: "pembekal", label: "Pembekal / vendor" },
  { value: "pihak", label: "Agensi / jabatan" },
  { value: "bahan", label: "Bahan / stok" },
  { value: "alat", label: "Alat / mesin" },
  { value: "sistem", label: "Sistem / aplikasi" },
  { value: "duit", label: "Kos / bajet" },
  { value: "cuaca", label: "Cuaca / luar kawalan" },
  { value: "lain", label: "Lain-lain" }
];
const PARTY_LABEL = Object.fromEntries(PARTY_TYPES.map(item => [item.value, item.label]));

/* Cadangan siap pakai — {pihak} digantikan dengan nama pihak yang kau isi */
const SUGGESTION_BANK = [
  "Hubungi {pihak} terus dan minta kepastian bertulis",
  "Minta sambungan masa atau tarikh baharu",
  "Cari pembekal / pilihan alternatif",
  "Naikkan kepada penyelia atau pihak atasan",
  "Dokumenkan bukti dan hantar secara rasmi",
  "Pecahkan kerja kepada langkah lebih kecil",
  "Buat kerja lain dahulu, semak semula minggu depan",
  "Semak semula kos dan rundingkan harga"
];

/* ---------- Tarikh ---------- */
function isParse(value) { const [y, m, d] = String(value).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); }
function isIso(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function isToday() { return isIso(new Date()); }
function isLabel(value) { if (!value) return "—"; const d = isParse(value); return `${d.getDate()} ${ISSUE_MONTH[d.getMonth()]} ${d.getFullYear()}`; }
function isNewId() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }

/* ---------- Simpanan ---------- */
function loadIssues() { try { const v = JSON.parse(localStorage.getItem(ISSUE_KEY)); return Array.isArray(v) ? v : []; } catch { return []; } }
function saveIssues() { localStorage.setItem(ISSUE_KEY, JSON.stringify(issues)); }
function loadIssueUi() { try { return JSON.parse(localStorage.getItem(ISSUE_UI_KEY)) || {}; } catch { return {}; } }
function saveIssueUi() { try { localStorage.setItem(ISSUE_UI_KEY, JSON.stringify({ filter: issueFilter })); } catch { /* abaikan */ } }
function readTasks() { try { const v = JSON.parse(localStorage.getItem(ISSUE_TASKS_KEY)); return Array.isArray(v) ? v : []; } catch { return []; } }
function storedView() { try { return (JSON.parse(localStorage.getItem(ISSUE_VIEW_KEY)) || {}).view || "board"; } catch { return "board"; } }

let issues = loadIssues();
let issueFilter = loadIssueUi().filter || "open";
let editingIssue = null;
let confirmIssueDelete = false;

/* ---------- Pembantu ---------- */
function suggestionsOf(issue) { return Array.isArray(issue.suggestions) ? issue.suggestions : []; }
function findIssue(id) { return issues.find(item => item.id === id); }
function taskTitle(taskId) {
  const task = readTasks().find(item => item.id === taskId);
  return task ? (task.title || "Tanpa nama") : "";
}
function issuesForTask(taskId) { return issues.filter(issue => issue.taskId === taskId); }
function openIssuesForTask(taskId) { return issuesForTask(taskId).filter(issue => issue.status !== "resolved"); }
function partyText(issue) {
  const type = PARTY_LABEL[issue.partyType] || "Lain-lain";
  return issue.party ? `${type} · ${issue.party}` : type;
}

/* ==========================================================================
   Cip isu pada kad papan tugasan
   ========================================================================== */
function paintTaskChips() {
  document.querySelectorAll(".task-card[data-card]").forEach(card => {
    const taskId = card.dataset.card;
    const open = openIssuesForTask(taskId).length;
    const total = issuesForTask(taskId).length;
    const tools = card.querySelector(".row-actions");
    if (!tools) return;

    let chip = tools.querySelector(".issue-chip");
    if (!total) { if (chip) chip.remove(); }
    else {
      if (!chip) {
        chip = document.createElement("button");
        chip.type = "button";
        chip.className = "issue-chip";
        tools.insertBefore(chip, tools.firstChild);
      }
      chip.dataset.issueChip = taskId;
      chip.classList.toggle("is-clear", open === 0);
      chip.textContent = open ? `⚠ ${open}` : `✓ ${total}`;
      chip.title = open ? `${open} isu belum selesai` : `${total} isu, semua selesai`;
      chip.setAttribute("aria-label", chip.title);
    }

    const foot = card.querySelector(".task-card-bottom");
    if (foot && !foot.querySelector(".issue-add")) {
      const add = document.createElement("button");
      add.type = "button";
      add.className = "issue-add";
      add.dataset.issueAdd = taskId;
      add.textContent = "+ Isu";
      foot.append(add);
    }
  });
}

document.addEventListener("ft-tasks-rendered", paintTaskChips);
document.addEventListener("click", event => {
  const chip = event.target.closest("[data-issue-chip]");
  if (chip) { gotoIssues(chip.dataset.issueChip); return; }
  const add = event.target.closest("[data-issue-add]");
  if (add) { openIssueDialog(null, add.dataset.issueAdd); }
});

function gotoIssues(taskId) {
  const button = document.querySelector('[data-view="issues"]');
  if (button) button.click();
  issueFilter = "all";
  saveIssueUi();
  renderIssues();
  const card = document.querySelector(`[data-issue-card-task="${taskId}"]`);
  if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
}

/* ==========================================================================
   Paparan senarai isu
   ========================================================================== */
function visibleIssues() {
  const sorted = issues.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (issueFilter === "open") return sorted.filter(issue => issue.status !== "resolved");
  if (issueFilter === "resolved") return sorted.filter(issue => issue.status === "resolved");
  return sorted;
}

function suggestionMarkup(issue, suggestion) {
  const chosen = issue.chosenId === suggestion.id;
  return `<div class="sg-row${chosen ? " is-chosen" : ""}" data-sg="${suggestion.id}">
      <button type="button" class="sg-pick" data-pick="${suggestion.id}" data-issue="${issue.id}"
        aria-label="${chosen ? "Buang pilihan" : "Pilih cadangan ini"}">${chosen ? "★" : "☆"}</button>
      <span class="sg-text"></span>
      ${chosen ? `<button type="button" class="sg-task" data-make-task="${suggestion.id}" data-issue="${issue.id}">Jadikan task</button>` : ""}
      <button type="button" class="sg-del" data-sg-del="${suggestion.id}" data-issue="${issue.id}" aria-label="Buang cadangan">×</button>
    </div>`;
}

function renderIssues() {
  const section = is$("#issuesView");
  if (!section) return;

  const open = issues.filter(issue => issue.status !== "resolved");
  const resolved = issues.filter(issue => issue.status === "resolved");
  const undecided = open.filter(issue => !issue.chosenId);
  is$("#issueOpen").textContent = open.length;
  is$("#issueOpenNote").textContent = open.length ? "Belum selesai" : "Semua bersih";
  is$("#issueUndecided").textContent = undecided.length;
  is$("#issueUndecidedNote").textContent = undecided.length ? "Belum pilih tindakan" : "Semua ada tindakan";
  is$("#issueDone").textContent = resolved.length;
  is$("#issueDoneNote").textContent = resolved.length ? "Sudah diselesaikan" : "—";

  document.querySelectorAll("[data-issue-filter]").forEach(button => {
    button.classList.toggle("active", button.dataset.issueFilter === issueFilter);
  });

  const list = is$("#issueList");
  const items = visibleIssues();
  is$("#issueCount").textContent = `${items.length} isu`;
  list.innerHTML = "";

  if (!issues.length) {
    list.append(is$("#emptyIssueTemplate").content.cloneNode(true));
    return;
  }
  if (!items.length) {
    const messages = { open: "Tiada isu terbuka. 👍", resolved: "Belum ada isu yang ditandakan selesai.", all: "Tiada rekod." };
    list.innerHTML = `<p class="empty-goal">${messages[issueFilter] || messages.all}</p>`;
    return;
  }

  items.forEach(issue => {
    const resolvedFlag = issue.status === "resolved";
    const suggestions = suggestionsOf(issue);
    const chosen = suggestions.find(item => item.id === issue.chosenId);
    const linked = taskTitle(issue.taskId);
    const card = document.createElement("article");
    card.className = `issue-card${resolvedFlag ? " is-resolved" : ""}${!resolvedFlag && !issue.chosenId ? " is-undecided" : ""}`;
    card.dataset.issueCardTask = issue.taskId || "";

    card.innerHTML = `<div class="issue-head">
        <div class="issue-ident">
          <span class="issue-state">${resolvedFlag ? "SELESAI" : issue.chosenId ? "ADA TINDAKAN" : "BELUM ADA TINDAKAN"}</span>
          <h3></h3>
          <p class="issue-meta"><span class="issue-party"></span><span class="issue-date">${isLabel(issue.date)}</span></p>
        </div>
        <span class="row-actions">
          <button type="button" class="edit-button" data-edit-issue="${issue.id}" aria-label="Edit isu">✎</button>
        </span>
      </div>
      ${linked ? `<p class="issue-link"><span>Task:</span><b></b></p>` : `<p class="issue-link issue-link-none"><span>Tiada task berkaitan</span></p>`}
      ${issue.detail ? `<p class="issue-detail"></p>` : ""}
      <div class="sg-block">
        <p class="sg-title">Cadangan penyelesaian <span class="sg-count">${suggestions.length}</span></p>
        <div class="sg-list">${suggestions.map(item => suggestionMarkup(issue, item)).join("") || '<p class="sg-empty">Belum ada cadangan. Tambah di bawah atau pilih cadangan siap pakai.</p>'}</div>
        <div class="sg-add-row">
          <input class="sg-add" type="text" maxlength="120" placeholder="Tulis cadangan penyelesaian" data-sg-add="${issue.id}" aria-label="Cadangan baharu" />
          <button type="button" class="sg-plus" data-sg-plus="${issue.id}" aria-label="Tambah cadangan">+</button>
        </div>
        <details class="sg-bank"><summary>Cadangan siap pakai</summary><div class="sg-bank-list">${
          SUGGESTION_BANK.map(text => `<button type="button" class="sg-bank-item" data-bank="${issue.id}"></button>`).join("")
        }</div></details>
      </div>
      <div class="issue-foot">
        ${chosen ? `<p class="issue-chosen"><span>Tindakan dipilih</span><b></b></p>` : `<p class="issue-chosen issue-chosen-none"><span>Belum pilih tindakan — tekan ☆ pada cadangan</span></p>`}
        <button type="button" class="issue-resolve" data-resolve="${issue.id}">${resolvedFlag ? "Buka semula" : "Tandakan selesai"}</button>
      </div>
      ${resolvedFlag && issue.resolvedAt ? `<p class="issue-note">Ditandakan selesai pada ${isLabel(issue.resolvedAt)}</p>` : ""}`;

    card.querySelector("h3").textContent = issue.title || "Isu tanpa tajuk";
    card.querySelector(".issue-party").textContent = partyText(issue);
    if (linked) card.querySelector(".issue-link b").textContent = linked;
    if (issue.detail) card.querySelector(".issue-detail").textContent = issue.detail;
    if (chosen) card.querySelector(".issue-chosen b").textContent = chosen.text;
    card.querySelectorAll(".sg-text").forEach((node, index) => { node.textContent = suggestions[index].text; });
    card.querySelectorAll(".sg-bank-item").forEach((node, index) => {
      node.textContent = SUGGESTION_BANK[index].replace("{pihak}", issue.party || PARTY_LABEL[issue.partyType] || "pihak terlibat");
    });
    list.append(card);
  });
}

/* ==========================================================================
   Tindakan
   ========================================================================== */
function addSuggestion(issueId, text) {
  const issue = findIssue(issueId);
  const clean = String(text || "").trim();
  if (!issue || !clean) return false;
  if (!Array.isArray(issue.suggestions)) issue.suggestions = [];
  issue.suggestions.push({ id: isNewId(), text: clean.slice(0, 120), createdAt: Date.now() });
  saveIssues();
  return true;
}

function bindIssuePage() {
  is$(".issue-filter").addEventListener("click", event => {
    const button = event.target.closest("[data-issue-filter]");
    if (!button) return;
    issueFilter = button.dataset.issueFilter;
    saveIssueUi();
    renderIssues();
  });

  is$("#issueNew").addEventListener("click", () => openIssueDialog(null, ""));
  is$("#issueEmptyNew")?.addEventListener("click", () => openIssueDialog(null, ""));

  is$("#issueList").addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-issue]");
    if (edit) { openIssueDialog(edit.dataset.editIssue); return; }

    const plus = event.target.closest("[data-sg-plus]");
    if (plus) {
      const input = document.querySelector(`[data-sg-add="${plus.dataset.sgPlus}"]`);
      if (addSuggestion(plus.dataset.sgPlus, input && input.value)) renderIssues();
      return;
    }
    const bank = event.target.closest("[data-bank]");
    if (bank) { if (addSuggestion(bank.dataset.bank, bank.textContent)) renderIssues(); return; }

    const pick = event.target.closest("[data-pick]");
    if (pick) {
      const issue = findIssue(pick.dataset.issue);
      if (!issue) return;
      issue.chosenId = issue.chosenId === pick.dataset.pick ? "" : pick.dataset.pick;
      saveIssues();
      renderIssues();
      return;
    }
    const del = event.target.closest("[data-sg-del]");
    if (del) {
      const issue = findIssue(del.dataset.issue);
      if (!issue) return;
      issue.suggestions = suggestionsOf(issue).filter(item => item.id !== del.dataset.sgDel);
      if (issue.chosenId === del.dataset.sgDel) issue.chosenId = "";
      saveIssues();
      renderIssues();
      return;
    }
    const make = event.target.closest("[data-make-task]");
    if (make) { makeTaskFromSuggestion(make.dataset.issue, make.dataset.makeTask); return; }

    const resolve = event.target.closest("[data-resolve]");
    if (resolve) {
      const issue = findIssue(resolve.dataset.resolve);
      if (!issue) return;
      if (issue.status === "resolved") { issue.status = "open"; issue.resolvedAt = ""; }
      else { issue.status = "resolved"; issue.resolvedAt = isToday(); }
      saveIssues();
      renderIssues();
      paintTaskChips();
    }
  });

  is$("#issueList").addEventListener("keydown", event => {
    const input = event.target.closest("[data-sg-add]");
    if (input && event.key === "Enter") {
      event.preventDefault();
      if (addSuggestion(input.dataset.sgAdd, input.value)) renderIssues();
    }
  });

  is$("#issueForm").addEventListener("submit", saveIssueDialog);
  is$("#issueDelete").addEventListener("click", deleteIssue);
  is$("#issueClose").addEventListener("click", () => { editingIssue = null; is$("#issueDialog").close(); });
}

function makeTaskFromSuggestion(issueId, suggestionId) {
  const issue = findIssue(issueId);
  const suggestion = suggestionsOf(issue || {}).find(item => item.id === suggestionId);
  if (!issue || !suggestion) return;
  const tasks = readTasks();
  const due = isIso(new Date(Date.now() + 3 * 86400000));
  tasks.push({
    id: isNewId(),
    title: suggestion.text.slice(0, 100),
    status: "pending",
    dueDate: due,
    focus: false,
    note: `Dari isu: ${issue.title || ""}`.slice(0, 100),
    createdAt: Date.now()
  });
  localStorage.setItem(ISSUE_TASKS_KEY, JSON.stringify(tasks));
  document.dispatchEvent(new CustomEvent("ft-cloud-data", { detail: { name: "tasks" } }));
  const button = document.querySelector(`[data-make-task="${suggestionId}"]`);
  if (button) { button.textContent = "Task dibuat ✓"; button.disabled = true; }
}

/* ---------- Dialog ---------- */
function fillTaskOptions(selected) {
  const select = is$("#issueTask");
  const tasks = readTasks().filter(task => task.status !== "complete");
  const extra = selected && !tasks.some(task => task.id === selected) ? readTasks().filter(task => task.id === selected) : [];
  select.innerHTML = `<option value="">— Tiada task berkaitan —</option>` +
    [...tasks, ...extra].map(task => `<option value="${task.id}"></option>`).join("");
  [...tasks, ...extra].forEach((task, index) => { select.options[index + 1].textContent = task.title || "Tanpa nama"; });
  select.value = selected || "";
}

function openIssueDialog(issueId, taskId) {
  editingIssue = issueId || null;
  confirmIssueDelete = false;
  const issue = issueId ? findIssue(issueId) : null;
  is$("#issueDialogTitle").textContent = issue ? "Edit isu" : "Isu baharu";
  is$("#issuePartyType").innerHTML = PARTY_TYPES.map(item => `<option value="${item.value}">${item.label}</option>`).join("");
  is$("#issueTitle").value = issue ? issue.title || "" : "";
  is$("#issuePartyType").value = issue ? issue.partyType || "orang" : "orang";
  is$("#issueParty").value = issue ? issue.party || "" : "";
  is$("#issueDetail").value = issue ? issue.detail || "" : "";
  is$("#issueDate").value = issue ? issue.date || isToday() : isToday();
  fillTaskOptions(issue ? issue.taskId : (taskId || ""));
  is$("#issueDelete").hidden = !issue;
  is$("#issueDelete").textContent = "Padam isu ini";
  is$("#issueDialog").showModal();
  is$("#issueTitle").focus();
}

function saveIssueDialog(event) {
  event.preventDefault();
  const title = is$("#issueTitle").value.trim();
  if (!title) return;
  const payload = {
    title,
    taskId: is$("#issueTask").value || "",
    partyType: is$("#issuePartyType").value || "lain",
    party: is$("#issueParty").value.trim(),
    detail: is$("#issueDetail").value.trim(),
    date: is$("#issueDate").value || isToday()
  };
  if (editingIssue) {
    const issue = findIssue(editingIssue);
    if (issue) Object.assign(issue, payload);
  } else {
    issues.push({ id: isNewId(), ...payload, status: "open", chosenId: "", suggestions: [], createdAt: Date.now() });
    issueFilter = "open";
    saveIssueUi();
  }
  saveIssues();
  editingIssue = null;
  is$("#issueDialog").close();
  renderIssues();
  paintTaskChips();
}

function deleteIssue() {
  if (!editingIssue) return;
  if (!confirmIssueDelete) {
    confirmIssueDelete = true;
    is$("#issueDelete").textContent = "Tekan sekali lagi untuk padam";
    return;
  }
  issues = issues.filter(item => item.id !== editingIssue);
  saveIssues();
  editingIssue = null;
  confirmIssueDelete = false;
  is$("#issueDialog").close();
  renderIssues();
  paintTaskChips();
}

/* ---------- Tukar paparan ---------- */
function applyIssueView(next) {
  const section = is$("#issuesView");
  if (section) section.hidden = next !== "issues";
  if (next === "issues") renderIssues();
}

document.querySelectorAll("[data-view]").forEach(button => {
  button.addEventListener("click", () => applyIssueView(button.dataset.view));
});

document.addEventListener("ft-cloud-data", event => {
  const name = event.detail && event.detail.name;
  if (name && name !== "issues" && name !== "tasks") return;
  if (name !== "tasks") issues = loadIssues();
  renderIssues();
  paintTaskChips();
});

if (is$("#issuesView")) {
  bindIssuePage();
  applyIssueView(storedView());
  paintTaskChips();
}

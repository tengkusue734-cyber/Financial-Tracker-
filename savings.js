// Page Simpanan — papar dan kemas kini rekod simpanan dari dashboard.
// Rekod hanya berubah bila kau sendiri tekan ✎ dan simpan.
// Sasaran simpanan disimpan berasingan dalam kunci sendiri.
const SAVINGS_STORAGE_KEY = "financial-tracker-transactions-v1";
const SAVINGS_CATEGORY_KEY = "financial-tracker-categories-v1";
const SAVINGS_GOAL_KEY = "financial-tracker-savings-goals-v1";
const defaultSavingsCategories = ["Simpanan Bank", "Dana Kecemasan", "ASB", "Tabung Haji", "Pelaburan", "Lain-lain"];
const save$ = selector => document.querySelector(selector);
const savingsPalette = ["#7e22ce", "#0ea5e9", "#16a34a", "#f59e0b", "#ec4899", "#0f766e", "#6366f1", "#b45309"];
let savingsScope = "month";
let editingSavingsId = null;
let confirmDeleteSavings = false;

function readAllTransactions() { try { return JSON.parse(localStorage.getItem(SAVINGS_STORAGE_KEY)) || []; } catch { return []; } }
function writeTransactions(list) { localStorage.setItem(SAVINGS_STORAGE_KEY, JSON.stringify(list)); }
function savingsMoney(value) { return new Intl.NumberFormat("ms-MY", { style: "currency", currency: "MYR" }).format(value); }
function savingsDateLabel(date) { return new Intl.DateTimeFormat("ms-MY", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T12:00:00`)); }

function allSavingsRecords() { return readAllTransactions().filter(item => item.type === "savings"); }
function readGoals() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVINGS_GOAL_KEY)) || {};
    const result = {};
    Object.entries(saved).forEach(([category, value]) => {
      const goal = typeof value === "number" ? { amount: value, period: "total" } : value;
      if (goal && Number(goal.amount) > 0) result[category] = { amount: Number(goal.amount), period: goal.period === "monthly" ? "monthly" : "total" };
    });
    return result;
  } catch { return {}; }
}
function saveGoals(goals) { localStorage.setItem(SAVINGS_GOAL_KEY, JSON.stringify(goals)); }
function knownCategories() {
  let custom = [];
  try { custom = (JSON.parse(localStorage.getItem(SAVINGS_CATEGORY_KEY)) || {}).savings || []; } catch { custom = []; }
  const used = allSavingsRecords().map(item => item.category || "Lain-lain");
  return [...new Set([...defaultSavingsCategories, ...custom, ...used, ...Object.keys(readGoals())])];
}
function monthLabel(value) { return new Intl.DateTimeFormat("ms-MY", { month: "long", year: "numeric" }).format(new Date(`${value}-01T12:00:00`)); }

function renderGoals() {
  const goals = readGoals();
  const entries = Object.entries(goals);
  const selectedMonth = save$("#savingsMonth").value;
  save$("#goalCount").textContent = `${entries.length} sasaran`;

  const select = save$("#goalCategory");
  const previous = select.value;
  select.innerHTML = "";
  knownCategories().forEach(category => {
    const option = document.createElement("option");
    option.value = category; option.textContent = category; option.selected = category === previous;
    select.append(option);
  });

  const list = save$("#goalList");
  list.innerHTML = "";
  if (!entries.length) { list.append(save$("#emptyGoalTemplate").content.cloneNode(true)); return; }

  const rows = entries.map(([category, goal]) => {
    const records = allSavingsRecords().filter(item => (item.category || "Lain-lain") === category);
    const scoped = goal.period === "monthly" ? records.filter(item => (item.date || "").startsWith(selectedMonth)) : records;
    const saved = scoped.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { category, goal, saved, percent: goal.amount ? (saved / goal.amount) * 100 : 0 };
  }).sort((a, b) => (a.percent >= 100) - (b.percent >= 100) || b.percent - a.percent);

  rows.forEach(row => {
    const done = row.percent >= 100;
    const shortfall = Math.max(0, row.goal.amount - row.saved);
    const card = document.createElement("article");
    card.className = `goal-card${done ? " is-done" : ""}`;
    card.innerHTML = `<div class="goal-card-top"><div><span class="goal-period">${row.goal.period === "monthly" ? `Setiap bulan · ${monthLabel(selectedMonth)}` : "Sepanjang masa"}</span><h3></h3></div><span class="row-actions"><button type="button" class="edit-button" data-edit-goal="${encodeURIComponent(row.category)}" aria-label="Edit sasaran">✎</button><button type="button" class="delete-button" data-goal="${encodeURIComponent(row.category)}" aria-label="Padam sasaran">×</button></span></div><div class="progress-bar"><span style="width:${Math.min(100, row.percent).toFixed(1)}%"></span></div><div class="goal-card-bottom"><span>${savingsMoney(row.saved)} daripada ${savingsMoney(row.goal.amount)}</span><strong>${done ? "Tercapai 🎉" : `${row.percent.toFixed(0)}% · baki ${savingsMoney(shortfall)}`}</strong></div>`;
    card.querySelector("h3").textContent = row.category;
    list.append(card);
  });
}

function savingsInScope() {
  const records = readAllTransactions().filter(item => item.type === "savings");
  const selected = save$("#savingsMonth").value;
  const filtered = savingsScope === "month" ? records.filter(item => (item.date || "").startsWith(selected)) : records;
  return filtered.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || 0) - (a.createdAt || 0));
}

function renderSavings() {
  const records = savingsInScope();
  const total = records.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const groups = new Map();
  records.forEach(item => {
    const category = item.category || "Lain-lain";
    const group = groups.get(category) || { total: 0, count: 0 };
    group.total += Number(item.amount || 0);
    group.count += 1;
    groups.set(category, group);
  });
  const ranked = [...groups.entries()].sort((a, b) => b[1].total - a[1].total);

  save$("#savingsTotal").textContent = savingsMoney(total);
  save$("#savingsCount").textContent = `${records.length}`;
  save$("#savingsAverage").textContent = savingsMoney(records.length ? total / records.length : 0);
  save$("#savingsCategoryCount").textContent = `${ranked.length}`;
  save$("#savingsTop").textContent = ranked.length ? ranked[0][0] : "—";
  save$("#breakdownScope").textContent = savingsScope === "month" ? "Bulan ini" : "Sepanjang masa";
  save$("#savingsRecordCount").textContent = `${records.length} rekod`;

  const breakdown = save$("#categoryBreakdown");
  breakdown.innerHTML = "";
  if (!ranked.length) {
    breakdown.append(save$("#emptySavingsTemplate").content.cloneNode(true));
  } else {
    ranked.forEach(([category, group], index) => {
      const share = total ? (group.total / total) * 100 : 0;
      const color = savingsPalette[index % savingsPalette.length];
      const row = document.createElement("article");
      row.className = "category-row";
      row.innerHTML = `<div class="category-row-top"><span class="category-name"><i style="background:${color}"></i><b></b></span><span class="category-amount">${savingsMoney(group.total)}</span></div><div class="progress-bar"><span style="width:${share.toFixed(1)}%; background:${color}"></span></div><div class="category-row-bottom"><span>${group.count} rekod</span><span>${share.toFixed(1)}% daripada jumlah</span></div>`;
      row.querySelector("b").textContent = category;
      breakdown.append(row);
    });
  }

  const list = save$("#savingsList");
  list.innerHTML = "";
  if (!records.length) { list.append(save$("#emptySavingsTemplate").content.cloneNode(true)); return; }
  records.forEach(item => {
    const row = document.createElement("article");
    row.className = "transaction savings";
    row.innerHTML = `<div class="transaction-icon">◎</div><div><p class="transaction-title"></p><span class="transaction-meta"></span></div><div class="row-end"><span class="transaction-amount">${savingsMoney(Number(item.amount || 0))}</span><button class="edit-button" type="button" data-edit-savings="${item.id}" aria-label="Edit rekod simpanan">✎</button></div>`;
    row.querySelector(".transaction-title").textContent = item.description || "Simpanan";
    row.querySelector(".transaction-meta").textContent = `${item.category || "Lain-lain"} · ${item.paymentMethod || "—"} · ${savingsDateLabel(item.date)}`;
    list.append(row);
  });
}

function renderPage() { renderSavings(); renderGoals(); }

save$("#savingsMonth").value = new Date().toISOString().slice(0, 7);
save$("#savingsMonth").addEventListener("change", renderPage);
document.querySelectorAll("[data-scope]").forEach(button => button.addEventListener("click", () => {
  savingsScope = button.dataset.scope;
  document.querySelectorAll("[data-scope]").forEach(other => other.classList.toggle("active", other === button));
  save$("#savingsMonth").hidden = savingsScope === "all";
  renderPage();
}));
save$("#goalForm").addEventListener("submit", event => {
  event.preventDefault();
  const amount = Number(save$("#goalAmount").value);
  const category = save$("#goalCategory").value;
  if (!category || !amount || amount <= 0) return;
  const goals = readGoals();
  goals[category] = { amount, period: save$("#goalPeriod").value };
  saveGoals(goals);
  save$("#goalAmount").value = "";
  renderGoals();
});
save$("#goalList").addEventListener("click", event => {
  const button = event.target.closest("[data-goal]");
  if (!button) return;
  const goals = readGoals();
  delete goals[decodeURIComponent(button.dataset.goal)];
  saveGoals(goals);
  renderGoals();
});

/* ---------- Edit rekod simpanan ---------- */
save$("#savingsList").addEventListener("click", event => {
  const button = event.target.closest("[data-edit-savings]");
  if (!button) return;
  const record = readAllTransactions().find(item => item.id === button.dataset.editSavings);
  if (!record) return;
  editingSavingsId = record.id; confirmDeleteSavings = false;
  const select = save$("#editSavingsCategory");
  select.innerHTML = "";
  knownCategories().forEach(category => { const option = document.createElement("option"); option.value = category; option.textContent = category; option.selected = category === record.category; select.append(option); });
  save$("#editSavingsAmount").value = record.amount;
  save$("#editSavingsDescription").value = record.description || "";
  save$("#editSavingsMethod").value = record.paymentMethod || "Cash";
  save$("#editSavingsDate").value = record.date;
  save$("#deleteSavings").textContent = "Padam rekod ini";
  save$("#savingsDialog").showModal(); save$("#editSavingsAmount").focus();
});
save$("#closeSavingsEdit").addEventListener("click", () => save$("#savingsDialog").close());
save$("#savingsEditForm").addEventListener("submit", event => {
  event.preventDefault();
  const amount = Number(save$("#editSavingsAmount").value);
  if (!editingSavingsId || !amount || amount <= 0) return;
  const list = readAllTransactions();
  const record = list.find(item => item.id === editingSavingsId);
  if (!record) return;
  record.amount = amount;
  record.description = save$("#editSavingsDescription").value.trim();
  record.category = save$("#editSavingsCategory").value;
  record.paymentMethod = save$("#editSavingsMethod").value;
  record.date = save$("#editSavingsDate").value;
  writeTransactions(list);
  save$("#savingsMonth").value = record.date.slice(0, 7);
  save$("#savingsDialog").close(); editingSavingsId = null; renderPage();
});
save$("#deleteSavings").addEventListener("click", () => {
  if (!editingSavingsId) return;
  if (!confirmDeleteSavings) { confirmDeleteSavings = true; save$("#deleteSavings").textContent = "Tekan sekali lagi untuk padam"; return; }
  writeTransactions(readAllTransactions().filter(item => item.id !== editingSavingsId));
  save$("#savingsDialog").close(); editingSavingsId = null; confirmDeleteSavings = false; renderPage();
});

/* ---------- Edit sasaran ---------- */
save$("#goalList").addEventListener("click", event => {
  const button = event.target.closest("[data-edit-goal]");
  if (!button) return;
  const category = decodeURIComponent(button.dataset.editGoal);
  const goal = readGoals()[category];
  if (!goal) return;
  save$("#goalCategory").value = category;
  save$("#goalAmount").value = goal.amount;
  save$("#goalPeriod").value = goal.period;
  save$("#goalAmount").focus();
  save$("#goalAmount").scrollIntoView({ behavior: "smooth", block: "center" });
});

document.addEventListener("ft-cloud-data", renderPage);
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
renderPage();

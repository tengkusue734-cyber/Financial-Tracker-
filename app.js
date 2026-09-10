const STORAGE_KEY = "financial-tracker-transactions-v1";
const CATEGORY_STORAGE_KEY = "financial-tracker-categories-v1";
const defaultCategories = {
  expense: ["Makanan & Minuman", "Pengangkutan", "Bil & Utiliti", "Belanja Rumah", "Kesihatan", "Hiburan", "Shopping", "Lain-lain"],
  income: ["Gaji", "Elaun", "Komisen", "Pelaburan", "Hadiah", "Lain-lain"],
  savings: ["Simpanan Bank", "Dana Kecemasan", "ASB", "Tabung Haji", "Pelaburan", "Lain-lain"],
  sales: ["Jualan Produk", "Jualan Servis", "Jualan Online", "Jualan Cash", "Lain-lain"]
};
const $ = (selector) => document.querySelector(selector);
const today = new Date();
const monthFilter = $("#monthFilter");
const dialog = $("#transactionDialog");
let deferredInstallPrompt;
let transactions = readTransactions();
let customCategories = readCategories();
let editingTransactionId = null;

function dateValue(date) { return date.toISOString().slice(0, 10); }
function monthValue(date) { return dateValue(date).slice(0, 7); }
function money(value) { return new Intl.NumberFormat("ms-MY", { style: "currency", currency: "MYR" }).format(value); }
function readTransactions() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } }
function saveTransactions() { localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); }
function readCategories() { try { const saved = JSON.parse(localStorage.getItem(CATEGORY_STORAGE_KEY)) || {}; return { expense: saved.expense || [], income: saved.income || [], savings: saved.savings || [], sales: saved.sales || [] }; } catch { return { expense: [], income: [], savings: [], sales: [] }; } }
function saveCategories() { localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(customCategories)); }
function selectedTransactions() { return transactions.filter(t => t.date.startsWith(monthFilter.value)).sort((a,b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt); }

function render() {
  const items = selectedTransactions();
  const income = items.filter(t => t.type === "income").reduce((sum,t) => sum + t.amount, 0);
  const sales = items.filter(t => t.type === "sales").reduce((sum,t) => sum + t.amount, 0);
  const expense = items.filter(t => t.type === "expense").reduce((sum,t) => sum + t.amount, 0);
  const savings = items.filter(t => t.type === "savings").reduce((sum,t) => sum + t.amount, 0);
  $("#incomeTotal").textContent = money(income); $("#salesTotal").textContent = money(sales); $("#expenseTotal").textContent = money(expense); $("#savingsTotal").textContent = money(savings); $("#balance").textContent = money(income + sales - expense - savings);
  $("#transactionCount").textContent = `${items.length} transaksi`;
  const list = $("#transactionList"); list.innerHTML = "";
  if (!items.length) { list.append($("#emptyStateTemplate").content.cloneNode(true)); return; }
  items.forEach(t => {
    const row = document.createElement("article"); row.className = `transaction ${t.type}`;
    const sign = t.type === "income" || t.type === "sales" ? "+" : "−";
    const formattedDate = new Intl.DateTimeFormat("ms-MY", { day:"numeric", month:"short", year:"numeric" }).format(new Date(`${t.date}T12:00:00`));
    row.innerHTML = `<div class="transaction-icon">${sign}</div><div><p class="transaction-title"></p><span class="transaction-meta"></span></div><div class="row-end"><span class="transaction-amount">${sign}${money(t.amount)}</span><span class="row-actions"><button class="edit-button" type="button" data-edit-id="${t.id}" aria-label="Edit transaksi">✎</button><button class="delete-button" type="button" data-delete-id="${t.id}" aria-label="Padam transaksi">×</button></span></div>`;
    row.querySelector(".transaction-title").textContent = t.description;
    row.querySelector(".transaction-meta").textContent = `${t.category} · ${t.paymentMethod} · ${formattedDate}`;
    list.append(row);
  });
}
function setCategories(type, selectedCategory = "") { const allCategories = [...defaultCategories[type], ...(customCategories[type] || [])]; if (selectedCategory && !allCategories.includes(selectedCategory)) allCategories.push(selectedCategory); $("#category").innerHTML = ""; allCategories.forEach(category => { const option = document.createElement("option"); option.value = category; option.textContent = category; option.selected = category === selectedCategory; $("#category").append(option); }); }

function openForm(type, existing = null) {
  const labels = { expense: ["PERBELANJAAN", "belanja"], income: ["PENDAPATAN", "income"], savings: ["SIMPANAN", "simpanan"], sales: ["JUALAN", "jualan"] };
  editingTransactionId = existing ? existing.id : null;
  $("#transactionForm").reset();
  $("#transactionType").value = type;
  $("#formEyebrow").textContent = labels[type][0];
  $("#formTitle").textContent = existing ? `Kemas kini ${labels[type][1]}` : `Tambah ${labels[type][1]}`;
  $("#saveTransaction").textContent = existing ? "Kemas kini transaksi" : "Simpan transaksi";
  setCategories(type, existing ? existing.category : "");
  if (existing) {
    $("#amount").value = existing.amount;
    $("#description").value = existing.description || "";
    $("#paymentMethod").value = existing.paymentMethod || "Cash";
    $("#transactionDate").value = existing.date;
  } else {
    $("#transactionDate").value = dateValue(today);
  }
  dialog.showModal(); $("#amount").focus();
}

monthFilter.value = monthValue(today);
document.querySelectorAll("[data-open-form]").forEach(button => button.addEventListener("click", () => openForm(button.dataset.openForm)));
$("#closeDialog").addEventListener("click", () => dialog.close());
$("#addCategory").addEventListener("click", () => { const type = $("#transactionType").value; const input = $("#newCategory"); const name = input.value.trim().replace(/\s+/g, " "); if (!name) { input.focus(); return; } const exists = [...defaultCategories[type], ...(customCategories[type] || [])].some(category => category.toLocaleLowerCase() === name.toLocaleLowerCase()); if (!exists) { customCategories[type] = [...(customCategories[type] || []), name]; saveCategories(); } setCategories(type, name); input.value = ""; });
$("#transactionForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const type = $("#transactionType").value;
  const amount = Number($("#amount").value);
  if (!amount || amount <= 0) return;
  const details = { type, amount, description: $("#description").value.trim(), category: $("#category").value, paymentMethod: $("#paymentMethod").value, date: $("#transactionDate").value };
  if (editingTransactionId) {
    const existing = transactions.find(t => t.id === editingTransactionId);
    if (existing) Object.assign(existing, details);
  } else {
    transactions.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), ...details, createdAt: Date.now() });
  }
  editingTransactionId = null;
  saveTransactions(); dialog.close(); monthFilter.value = $("#transactionDate").value.slice(0,7); render();
});
$("#transactionList").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-id]");
  if (editButton) { const item = transactions.find(t => t.id === editButton.dataset.editId); if (item) openForm(item.type, item); return; }
  const deleteButton = event.target.closest("[data-delete-id]");
  if (!deleteButton) return;
  transactions = transactions.filter(t => t.id !== deleteButton.dataset.deleteId); saveTransactions(); render();
});
monthFilter.addEventListener("change", render);
window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferredInstallPrompt = event; $("#installButton").hidden = false; });
$("#installButton").addEventListener("click", async () => { if (!deferredInstallPrompt) return; deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; $("#installButton").hidden = true; });
document.addEventListener("ft-cloud-data", () => { transactions = readTransactions(); customCategories = readCategories(); render(); });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
render();

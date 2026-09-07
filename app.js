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
    row.innerHTML = `<div class="transaction-icon">${sign}</div><div><p class="transaction-title"></p><span class="transaction-meta"></span></div><div><span class="transaction-amount">${sign}${money(t.amount)}</span><button class="delete-button" type="button" aria-label="Padam transaksi" data-id="${t.id}">×</button></div>`;
    row.querySelector(".transaction-title").textContent = t.description;
    row.querySelector(".transaction-meta").textContent = `${t.category} · ${t.paymentMethod} · ${formattedDate}`;
    list.append(row);
  });
}
function setCategories(type, selectedCategory = "") { const allCategories = [...defaultCategories[type], ...(customCategories[type] || [])]; $("#category").innerHTML = ""; allCategories.forEach(category => { const option = document.createElement("option"); option.value = category; option.textContent = category; option.selected = category === selectedCategory; $("#category").append(option); }); }
function openForm(type) { const labels = { expense: ["PERBELANJAAN", "Tambah belanja"], income: ["PENDAPATAN", "Tambah income"], savings: ["SIMPANAN", "Rekod simpanan"], sales: ["JUALAN", "Rekod jualan"] }; $("#transactionType").value = type; $("#formEyebrow").textContent = labels[type][0]; $("#formTitle").textContent = labels[type][1]; setCategories(type); $("#transactionForm").reset(); $("#transactionType").value = type; $("#transactionDate").value = dateValue(today); dialog.showModal(); $("#amount").focus(); }

monthFilter.value = monthValue(today);
document.querySelectorAll("[data-open-form]").forEach(button => button.addEventListener("click", () => openForm(button.dataset.openForm)));
$("#closeDialog").addEventListener("click", () => dialog.close());
$("#addCategory").addEventListener("click", () => { const type = $("#transactionType").value; const input = $("#newCategory"); const name = input.value.trim().replace(/\s+/g, " "); if (!name) { input.focus(); return; } const exists = [...defaultCategories[type], ...(customCategories[type] || [])].some(category => category.toLocaleLowerCase() === name.toLocaleLowerCase()); if (!exists) { customCategories[type] = [...(customCategories[type] || []), name]; saveCategories(); } setCategories(type, name); input.value = ""; });
$("#transactionForm").addEventListener("submit", (event) => { event.preventDefault(); const type = $("#transactionType").value; const amount = Number($("#amount").value); if (!amount || amount <= 0) return; transactions.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), type, amount, description: $("#description").value.trim(), category: $("#category").value, paymentMethod: $("#paymentMethod").value, date: $("#transactionDate").value, createdAt: Date.now() }); saveTransactions(); dialog.close(); monthFilter.value = $("#transactionDate").value.slice(0,7); render(); });
$("#transactionList").addEventListener("click", (event) => { const button = event.target.closest("[data-id]"); if (!button) return; transactions = transactions.filter(t => t.id !== button.dataset.id); saveTransactions(); render(); });
monthFilter.addEventListener("change", render);
window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); deferredInstallPrompt = event; $("#installButton").hidden = false; });
$("#installButton").addEventListener("click", async () => { if (!deferredInstallPrompt) return; deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; $("#installButton").hidden = true; });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
render();

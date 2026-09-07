const DEBT_STORAGE_KEY = "financial-tracker-debts-v1";
const debt$ = (selector) => document.querySelector(selector);
const debtToday = new Date().toISOString().slice(0, 10);
let debts = loadDebts();
let activeDebtId = null;

function loadDebts() { try { return JSON.parse(localStorage.getItem(DEBT_STORAGE_KEY)) || []; } catch { return []; } }
function saveDebts() { localStorage.setItem(DEBT_STORAGE_KEY, JSON.stringify(debts)); }
function ringgit(value) { return new Intl.NumberFormat("ms-MY", { style: "currency", currency: "MYR" }).format(value); }
function paidTotal(debt) { return debt.payments.reduce((sum, payment) => sum + payment.amount, 0); }
function remaining(debt) { return Math.max(0, debt.amount - paidTotal(debt)); }
function activeDebts(type) { return debts.filter(debt => debt.type === type && remaining(debt) > 0); }
function dateLabel(date) { return new Intl.DateTimeFormat("ms-MY", { day:"numeric", month:"short", year:"numeric" }).format(new Date(`${date}T12:00:00`)); }

function renderDebts() {
  const receivables = activeDebts("receivable"); const payables = activeDebts("payable");
  debt$("#receivableTotal").textContent = ringgit(receivables.reduce((sum, debt) => sum + remaining(debt), 0)); debt$("#receivableCount").textContent = `${receivables.length} rekod aktif`;
  debt$("#payableTotal").textContent = ringgit(payables.reduce((sum, debt) => sum + remaining(debt), 0)); debt$("#payableCount").textContent = `${payables.length} rekod aktif`;
  const list = debt$("#debtList"); const active = [...receivables, ...payables].sort((a,b) => b.createdAt - a.createdAt); debt$("#debtRecordCount").textContent = `${active.length} rekod aktif`; list.innerHTML = "";
  if (!active.length) { list.append(debt$("#emptyDebtTemplate").content.cloneNode(true)); return; }
  active.forEach(debt => {
    const isReceivable = debt.type === "receivable"; const outstanding = remaining(debt); const paid = paidTotal(debt); const card = document.createElement("article"); card.className = `debt-card ${debt.type}`;
    card.innerHTML = `<div class="debt-card-heading"><div><span class="debt-badge">${isReceivable ? "ORANG BERHUTANG DENGAN SAYA" : "HUTANG SAYA"}</span><h3></h3><p class="debt-note"></p></div><strong>${ringgit(outstanding)}</strong></div><div class="progress-bar"><span></span></div><div class="debt-card-footer"><span>Bayar: ${ringgit(paid)} daripada ${ringgit(debt.amount)}</span><button type="button" class="record-payment" data-id="${debt.id}">${isReceivable ? "Rekod bayaran diterima" : "Rekod bayaran dibuat"}</button></div>`;
    card.querySelector("h3").textContent = debt.name; card.querySelector(".debt-note").textContent = `${debt.note ? `${debt.note} · ` : ""}${dateLabel(debt.date)}`; card.querySelector(".progress-bar span").style.width = `${Math.min(100, (paid / debt.amount) * 100)}%`; list.append(card);
  });
}

debt$("#debtDate").value = debtToday; debt$("#paymentDate").value = debtToday;
debt$("#debtForm").addEventListener("submit", event => { event.preventDefault(); const amount = Number(debt$("#debtAmount").value); if (!amount || amount <= 0) return; debts.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), type: debt$("#debtType").value, name: debt$("#debtorName").value.trim(), amount, date: debt$("#debtDate").value, note: debt$("#debtNote").value.trim(), payments: [], createdAt: Date.now() }); saveDebts(); event.target.reset(); debt$("#debtDate").value = debtToday; renderDebts(); });
debt$("#debtList").addEventListener("click", event => { const button = event.target.closest("[data-id]"); if (!button) return; const debt = debts.find(item => item.id === button.dataset.id); if (!debt) return; activeDebtId = debt.id; const isReceivable = debt.type === "receivable"; debt$("#paymentTitle").textContent = isReceivable ? "Rekod bayaran diterima" : "Rekod bayaran dibuat"; debt$("#paymentHelp").textContent = `${debt.name} · Baki semasa: ${ringgit(remaining(debt))}`; debt$("#paymentAmount").max = remaining(debt); debt$("#paymentAmount").value = ""; debt$("#paymentDate").value = debtToday; debt$("#paymentDialog").showModal(); debt$("#paymentAmount").focus(); });
debt$("#closePayment").addEventListener("click", () => debt$("#paymentDialog").close());
debt$("#paymentForm").addEventListener("submit", event => { event.preventDefault(); const debt = debts.find(item => item.id === activeDebtId); const amount = Number(debt$("#paymentAmount").value); if (!debt || !amount || amount <= 0 || amount > remaining(debt)) return; debt.payments.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), amount, date: debt$("#paymentDate").value, note: debt$("#paymentNote").value.trim() }); saveDebts(); debt$("#paymentDialog").close(); renderDebts(); });
document.addEventListener("ft-cloud-data", () => { debts = loadDebts(); renderDebts(); });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
renderDebts();

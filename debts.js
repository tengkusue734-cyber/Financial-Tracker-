const DEBT_STORAGE_KEY = "financial-tracker-debts-v1";
const debt$ = (selector) => document.querySelector(selector);
const debtToday = new Date().toISOString().slice(0, 10);
let debts = loadDebts();
let activeDebtId = null;
let editingPaymentId = null;
let editingDebtId = null;
let debtFilter = "active";
let confirmDeleteDebt = false;
let confirmDeletePayment = false;

function loadDebts() { try { return JSON.parse(localStorage.getItem(DEBT_STORAGE_KEY)) || []; } catch { return []; } }
function saveDebts() { localStorage.setItem(DEBT_STORAGE_KEY, JSON.stringify(debts)); }
function ringgit(value) { return new Intl.NumberFormat("ms-MY", { style: "currency", currency: "MYR" }).format(value); }
function payments(debt) { return Array.isArray(debt.payments) ? debt.payments : []; }
function paidTotal(debt) { return payments(debt).reduce((sum, payment) => sum + Number(payment.amount || 0), 0); }
function remaining(debt) { return Math.max(0, Number(debt.amount || 0) - paidTotal(debt)); }
function isSettled(debt) { return remaining(debt) <= 0.004 && Number(debt.amount || 0) > 0; }
function activeDebts(type) { return debts.filter(debt => debt.type === type && !isSettled(debt)); }
function dateLabel(date) { return date ? new Intl.DateTimeFormat("ms-MY", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T12:00:00`)) : "—"; }
function settledDate(debt) { const dates = payments(debt).map(payment => payment.date).filter(Boolean).sort(); return dates.length ? dates[dates.length - 1] : debt.date; }
function setFilter(value) { debtFilter = value; document.querySelectorAll("[data-filter]").forEach(button => button.classList.toggle("active", button.dataset.filter === value)); }

function filteredDebts() {
  const list = debts.filter(debt => debtFilter === "all" ? true : debtFilter === "settled" ? isSettled(debt) : !isSettled(debt));
  if (debtFilter === "settled") return list.sort((a, b) => (settledDate(b) || "").localeCompare(settledDate(a) || ""));
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function renderDebts() {
  const receivables = activeDebts("receivable");
  const payables = activeDebts("payable");
  debt$("#receivableTotal").textContent = ringgit(receivables.reduce((sum, debt) => sum + remaining(debt), 0));
  debt$("#receivableCount").textContent = `${receivables.length} rekod aktif`;
  debt$("#payableTotal").textContent = ringgit(payables.reduce((sum, debt) => sum + remaining(debt), 0));
  debt$("#payableCount").textContent = `${payables.length} rekod aktif`;

  const received = debts.filter(debt => debt.type === "receivable").flatMap(payments);
  const paidOut = debts.filter(debt => debt.type === "payable").flatMap(payments);
  debt$("#receivedTotal").textContent = ringgit(received.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
  debt$("#receivedCount").textContent = `${received.length} bayaran masuk`;
  debt$("#paidTotal").textContent = ringgit(paidOut.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
  debt$("#paidCount").textContent = `${paidOut.length} bayaran keluar`;

  const list = debt$("#debtList");
  const visible = filteredDebts();
  debt$("#debtRecordCount").textContent = debtFilter === "settled" ? `${visible.length} selesai` : `${visible.length} rekod`;
  list.innerHTML = "";
  if (!visible.length) {
    const empty = debt$("#emptyDebtTemplate").content.cloneNode(true);
    if (debtFilter === "settled") {
      empty.querySelector("h3").textContent = "Belum ada hutang selesai";
      empty.querySelector("p").textContent = "Rekod yang sudah dijelaskan sepenuhnya akan disimpan di sini.";
    }
    list.append(empty);
    return;
  }

  visible.forEach(debt => {
    const isReceivable = debt.type === "receivable";
    const settled = isSettled(debt);
    const paid = paidTotal(debt);
    const log = payments(debt).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const card = document.createElement("article");
    card.className = `debt-card ${debt.type}${settled ? " is-settled" : ""}`;
    const badge = settled
      ? `<span class="debt-badge settled-badge">${isReceivable ? "SUDAH DIBAYAR KEPADA SAYA" : "SAYA SUDAH JELASKAN"}</span>`
      : `<span class="debt-badge">${isReceivable ? "ORANG BERHUTANG DENGAN SAYA" : "HUTANG SAYA"}</span>`;
    const action = settled
      ? `<span class="settled-mark">✓ Selesai ${dateLabel(settledDate(debt))}</span>`
      : `<button type="button" class="record-payment" data-pay-id="${debt.id}">${isReceivable ? "Rekod bayaran diterima" : "Rekod bayaran dibuat"}</button>`;
    card.innerHTML = `<div class="debt-card-heading"><div>${badge}<h3></h3><p class="debt-note"></p></div><div class="row-end"><strong>${settled ? ringgit(Number(debt.amount || 0)) : ringgit(remaining(debt))}</strong><button class="edit-button" type="button" data-edit-debt="${debt.id}" aria-label="Edit rekod hutang">✎</button></div></div><div class="progress-bar"><span></span></div><div class="debt-card-footer"><span>Bayar: ${ringgit(paid)} daripada ${ringgit(Number(debt.amount || 0))}</span>${action}</div>`;
    card.querySelector("h3").textContent = debt.name;
    card.querySelector(".debt-note").textContent = `${debt.note ? `${debt.note} · ` : ""}${dateLabel(debt.date)}`;
    card.querySelector(".progress-bar span").style.width = `${Math.min(100, (paid / Number(debt.amount || 1)) * 100)}%`;

    if (log.length) {
      const history = document.createElement("div");
      history.className = "payment-log";
      history.innerHTML = `<p class="payment-log-title">Rekod bayaran (${log.length})</p>`;
      log.forEach(payment => {
        const row = document.createElement("div");
        row.className = "payment-row";
        row.innerHTML = `<span></span><b>${ringgit(Number(payment.amount || 0))}</b><button class="edit-button small" type="button" data-edit-payment="${payment.id}" data-debt="${debt.id}" aria-label="Edit bayaran">✎</button>`;
        row.querySelector("span").textContent = `${dateLabel(payment.date)}${payment.note ? ` · ${payment.note}` : ""}`;
        history.append(row);
      });
      card.append(history);
    }
    list.append(card);
  });
}

/* ---------- Tambah hutang baharu ---------- */
debt$("#debtDate").value = debtToday; debt$("#paymentDate").value = debtToday;
debt$("#debtForm").addEventListener("submit", event => {
  event.preventDefault();
  const amount = Number(debt$("#debtAmount").value);
  if (!amount || amount <= 0) return;
  debts.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), type: debt$("#debtType").value, name: debt$("#debtorName").value.trim(), amount, date: debt$("#debtDate").value, note: debt$("#debtNote").value.trim(), payments: [], createdAt: Date.now() });
  saveDebts(); event.target.reset(); debt$("#debtDate").value = debtToday; setFilter("active"); renderDebts();
});
document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => { setFilter(button.dataset.filter); renderDebts(); }));

/* ---------- Klik dalam senarai ---------- */
debt$("#debtList").addEventListener("click", event => {
  const editDebt = event.target.closest("[data-edit-debt]");
  if (editDebt) return openDebtEditor(editDebt.dataset.editDebt);
  const editPayment = event.target.closest("[data-edit-payment]");
  if (editPayment) return openPaymentDialog(editPayment.dataset.debt, editPayment.dataset.editPayment);
  const pay = event.target.closest("[data-pay-id]");
  if (pay) return openPaymentDialog(pay.dataset.payId, null);
});

/* ---------- Dialog bayaran (tambah atau edit) ---------- */
function openPaymentDialog(debtId, paymentId) {
  const debt = debts.find(item => item.id === debtId);
  if (!debt) return;
  activeDebtId = debtId; editingPaymentId = paymentId; confirmDeletePayment = false;
  const isReceivable = debt.type === "receivable";
  const payment = paymentId ? payments(debt).find(item => item.id === paymentId) : null;
  debt$("#paymentTitle").textContent = payment ? "Edit rekod bayaran" : isReceivable ? "Rekod bayaran diterima" : "Rekod bayaran dibuat";
  debt$("#paymentHelp").textContent = `${debt.name} · Baki semasa: ${ringgit(remaining(debt))}`;
  debt$("#paymentAmount").max = remaining(debt) + Number(payment ? payment.amount : 0);
  debt$("#paymentAmount").value = payment ? payment.amount : "";
  debt$("#paymentDate").value = payment ? payment.date : debtToday;
  debt$("#paymentNote").value = payment ? payment.note || "" : "";
  debt$("#savePayment").textContent = payment ? "Kemas kini bayaran" : "Simpan bayaran";
  debt$("#deletePayment").hidden = !payment;
  debt$("#deletePayment").textContent = "Padam bayaran ini";
  debt$("#paymentDialog").showModal(); debt$("#paymentAmount").focus();
}
debt$("#closePayment").addEventListener("click", () => debt$("#paymentDialog").close());
debt$("#paymentForm").addEventListener("submit", event => {
  event.preventDefault();
  const debt = debts.find(item => item.id === activeDebtId);
  const amount = Number(debt$("#paymentAmount").value);
  if (!debt || !amount || amount <= 0) return;
  if (!Array.isArray(debt.payments)) debt.payments = [];
  const existing = editingPaymentId ? debt.payments.find(item => item.id === editingPaymentId) : null;
  const ceiling = remaining(debt) + Number(existing ? existing.amount : 0);
  if (amount > ceiling + 0.004) { debt$("#paymentHelp").textContent = `Jumlah melebihi baki hutang (maksimum ${ringgit(ceiling)}).`; return; }
  const details = { amount, date: debt$("#paymentDate").value, note: debt$("#paymentNote").value.trim() };
  if (existing) Object.assign(existing, details);
  else debt.payments.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), ...details });
  saveDebts(); debt$("#paymentDialog").close(); editingPaymentId = null;
  if (isSettled(debt)) setFilter("settled");
  renderDebts();
});
debt$("#deletePayment").addEventListener("click", () => {
  const debt = debts.find(item => item.id === activeDebtId);
  if (!debt || !editingPaymentId) return;
  if (!confirmDeletePayment) { confirmDeletePayment = true; debt$("#deletePayment").textContent = "Tekan sekali lagi untuk padam"; return; }
  debt.payments = payments(debt).filter(item => item.id !== editingPaymentId);
  saveDebts(); debt$("#paymentDialog").close(); editingPaymentId = null; confirmDeletePayment = false; renderDebts();
});

/* ---------- Dialog edit hutang ---------- */
function openDebtEditor(debtId) {
  const debt = debts.find(item => item.id === debtId);
  if (!debt) return;
  editingDebtId = debtId; confirmDeleteDebt = false;
  debt$("#editDebtType").value = debt.type;
  debt$("#editDebtName").value = debt.name || "";
  debt$("#editDebtAmount").value = debt.amount;
  debt$("#editDebtDate").value = debt.date || debtToday;
  debt$("#editDebtNote").value = debt.note || "";
  debt$("#editDebtHelp").textContent = paidTotal(debt) > 0 ? `Sudah dibayar ${ringgit(paidTotal(debt))} — jumlah asal tidak boleh kurang daripada itu.` : "";
  debt$("#deleteDebt").textContent = "Padam rekod hutang";
  debt$("#debtDialog").showModal(); debt$("#editDebtName").focus();
}
debt$("#closeDebtEdit").addEventListener("click", () => debt$("#debtDialog").close());
debt$("#debtEditForm").addEventListener("submit", event => {
  event.preventDefault();
  const debt = debts.find(item => item.id === editingDebtId);
  const amount = Number(debt$("#editDebtAmount").value);
  if (!debt || !amount || amount <= 0) return;
  if (amount < paidTotal(debt) - 0.004) { debt$("#editDebtHelp").textContent = `Jumlah asal tidak boleh kurang daripada bayaran yang sudah direkod (${ringgit(paidTotal(debt))}).`; return; }
  debt.type = debt$("#editDebtType").value;
  debt.name = debt$("#editDebtName").value.trim();
  debt.amount = amount;
  debt.date = debt$("#editDebtDate").value;
  debt.note = debt$("#editDebtNote").value.trim();
  saveDebts(); debt$("#debtDialog").close(); editingDebtId = null; renderDebts();
});
debt$("#deleteDebt").addEventListener("click", () => {
  if (!editingDebtId) return;
  if (!confirmDeleteDebt) { confirmDeleteDebt = true; debt$("#deleteDebt").textContent = "Tekan sekali lagi untuk padam"; return; }
  debts = debts.filter(item => item.id !== editingDebtId);
  saveDebts(); debt$("#debtDialog").close(); editingDebtId = null; confirmDeleteDebt = false; renderDebts();
});

document.addEventListener("ft-cloud-data", () => { debts = loadDebts(); renderDebts(); });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
renderDebts();

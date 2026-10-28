/* ==========================================================================
   Sijil & lesen bertempoh — jejak tarikh "sah sehingga"
   PENTING: fail ini guna kunci penyimpanan SENDIRI
   (financial-tracker-certs-v1). Ia tidak menulis kepada data transaksi,
   simpanan, hutang, task atau projek yang sedia ada.
   ========================================================================== */

const CERT_KEY = "financial-tracker-certs-v1";
const CERT_UI_KEY = "financial-tracker-ui-certs-v1";
const cert$ = selector => document.querySelector(selector);
const CERT_DAY = 86400000;
const CERT_MONTH = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
const DEFAULT_REMIND = 60;

/* ---------- Tarikh ---------- */
function certParse(value) { const [y, m, d] = String(value).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); }
function certIso(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function certToday() { return certIso(new Date()); }
function certDiff(from, to) { return Math.round((certParse(to) - certParse(from)) / CERT_DAY); }
function certAddMonths(value, months) {
  const d = certParse(value);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return certIso(d);
}
function certLabel(value) {
  if (!value) return "—";
  const d = certParse(value);
  return `${d.getDate()} ${CERT_MONTH[d.getMonth()]} ${d.getFullYear()}`;
}
function certNewId() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2); }

/* ---------- Simpanan ---------- */
function loadCerts() { try { const v = JSON.parse(localStorage.getItem(CERT_KEY)); return Array.isArray(v) ? v : []; } catch { return []; } }
function saveCerts() { localStorage.setItem(CERT_KEY, JSON.stringify(certs)); }
function loadCertUi() { try { return JSON.parse(localStorage.getItem(CERT_UI_KEY)) || {}; } catch { return {}; } }
function saveCertUi() { try { localStorage.setItem(CERT_UI_KEY, JSON.stringify({ filter: certFilter })); } catch { /* abaikan */ } }

let certs = loadCerts();
let certFilter = loadCertUi().filter || "action";
let editingCert = null;
let renewingCert = null;
let confirmCertDelete = false;

/* ---------- Status ---------- */
function remindDays(cert) { const n = Number(cert.remind); return Number.isFinite(n) && n >= 0 ? n : DEFAULT_REMIND; }
function daysLeft(cert) { return cert.expiry ? certDiff(certToday(), cert.expiry) : null; }
function certStatus(cert) {
  const left = daysLeft(cert);
  if (left === null) return "none";
  if (left < 0) return "expired";
  if (left <= remindDays(cert)) return "soon";
  return "ok";
}
function statusText(cert) {
  const left = daysLeft(cert);
  if (left === null) return "Tiada tarikh tamat";
  if (left < 0) return `Tamat tempoh ${Math.abs(left)} hari lalu`;
  if (left === 0) return "Tamat tempoh hari ini";
  if (left === 1) return "Tinggal 1 hari";
  return `Tinggal ${left} hari`;
}
function statusBadge(status) {
  return { expired: "TAMAT TEMPOH", soon: "HAMPIR TAMAT", ok: "MASIH SAH", none: "TIADA TARIKH" }[status] || "";
}
function validityPercent(cert) {
  if (!cert.expiry) return 0;
  const total = cert.issued ? certDiff(cert.issued, cert.expiry) : 365;
  if (total <= 0) return 100;
  const used = cert.issued ? certDiff(cert.issued, certToday()) : total - (daysLeft(cert) || 0);
  return Math.max(0, Math.min(100, Math.round((used / total) * 100)));
}
function sortedCerts() {
  return certs.slice().sort((a, b) => {
    const left = a.expiry ? certDiff(certToday(), a.expiry) : 99999;
    const right = b.expiry ? certDiff(certToday(), b.expiry) : 99999;
    return left - right;
  });
}
function needsAttention() {
  return sortedCerts().filter(cert => ["expired", "soon"].includes(certStatus(cert)));
}

/* ==========================================================================
   Peringatan ringkas pada Dashboard (hanya baca)
   ========================================================================== */
function renderCertAlert() {
  const holder = cert$("#certAlert");
  if (!holder) return;
  const list = needsAttention();
  if (!list.length) { holder.hidden = true; holder.innerHTML = ""; return; }
  const expired = list.filter(cert => certStatus(cert) === "expired").length;
  const first = list[0];
  holder.hidden = false;
  holder.className = `cert-alert${expired ? " is-expired" : ""}`;
  holder.innerHTML = `<span class="cert-alert-dot" aria-hidden="true"></span>
    <div class="cert-alert-text"><b></b><span></span></div>
    <a class="cert-alert-link" href="certs.html">Semak</a>`;
  holder.querySelector("b").textContent = list.length === 1
    ? `1 sijil perlu perhatian`
    : `${list.length} sijil perlu perhatian`;
  holder.querySelector(".cert-alert-text span").textContent = `${first.name || "Sijil"} · ${statusText(first)}`;
}

/* ==========================================================================
   Halaman sijil
   ========================================================================== */
const onCertPage = !!document.querySelector("#certForm");

function renderSummary() {
  const expired = certs.filter(cert => certStatus(cert) === "expired");
  const soon = certs.filter(cert => certStatus(cert) === "soon");
  const ok = certs.filter(cert => certStatus(cert) === "ok");
  cert$("#certTotal").textContent = certs.length;
  cert$("#certTotalNote").textContent = certs.length === 1 ? "1 rekod" : `${certs.length} rekod`;
  cert$("#certExpired").textContent = expired.length;
  cert$("#certExpiredNote").textContent = expired.length ? "Perlu diperbaharui" : "Tiada yang luput";
  cert$("#certSoon").textContent = soon.length;
  cert$("#certSoonNote").textContent = soon.length ? "Dalam tempoh amaran" : "Tiada amaran";
  cert$("#certOk").textContent = ok.length;
  cert$("#certOkNote").textContent = ok.length ? "Masih selamat" : "—";
}

function visibleCerts() {
  const all = sortedCerts();
  if (certFilter === "action") return all.filter(cert => ["expired", "soon"].includes(certStatus(cert)));
  if (certFilter === "ok") return all.filter(cert => certStatus(cert) === "ok");
  return all;
}

function renderCertList() {
  const list = cert$("#certList");
  const items = visibleCerts();
  cert$("#certCount").textContent = `${items.length} sijil`;
  list.innerHTML = "";

  if (!certs.length) {
    list.append(cert$("#emptyCertTemplate").content.cloneNode(true));
    return;
  }
  if (!items.length) {
    const messages = {
      action: "Tiada sijil yang hampir tamat atau sudah luput. Bagus. 👍",
      ok: "Tiada sijil yang masih jauh dari tarikh tamat.",
      all: "Tiada rekod."
    };
    list.innerHTML = `<p class="empty-goal">${messages[certFilter] || messages.all}</p>`;
    return;
  }

  items.forEach(cert => {
    const status = certStatus(cert);
    const card = document.createElement("article");
    card.className = `cert-card is-${status}`;
    const history = Array.isArray(cert.history) ? cert.history : [];
    card.innerHTML = `<div class="cert-card-top">
        <div class="cert-ident">
          <span class="cert-badge">${statusBadge(status)}</span>
          <h3></h3>
          <p class="cert-sub"></p>
        </div>
        <div class="cert-dates">
          <small>Sah sehingga</small>
          <strong></strong>
        </div>
      </div>
      <div class="progress-bar"><span style="width:${validityPercent(cert)}%"></span></div>
      <div class="cert-card-foot">
        <span class="cert-left"></span>
        <span class="row-actions">
          <button type="button" class="cert-renew" data-renew="${cert.id}">Perbaharui</button>
          <button type="button" class="edit-button" data-edit-cert="${cert.id}" aria-label="Edit sijil">✎</button>
        </span>
      </div>
      ${cert.note ? `<p class="cert-note"></p>` : ""}
      ${history.length ? `<div class="payment-log"><p class="payment-log-title">Rekod pembaharuan (${history.length})</p>${
        history.slice().reverse().map(row => `<div class="payment-row"><span>${certLabel(row.issued)} → ${certLabel(row.expiry)}</span><b>${row.renewedAt ? certLabel(row.renewedAt) : ""}</b></div>`).join("")
      }</div>` : ""}`;

    card.querySelector("h3").textContent = cert.name || "Tanpa nama";
    card.querySelector(".cert-sub").textContent = [cert.issuer, cert.number].filter(Boolean).join(" · ") || "Tiada butiran";
    card.querySelector(".cert-dates strong").textContent = certLabel(cert.expiry);
    card.querySelector(".cert-left").textContent = `${statusText(cert)} · amaran ${remindDays(cert)} hari sebelum`;
    if (cert.note) card.querySelector(".cert-note").textContent = cert.note;
    list.append(card);
  });
}

function renderCerts() {
  renderCertAlert();
  if (!onCertPage) return;
  renderSummary();
  renderCertList();
  document.querySelectorAll("[data-cert-filter]").forEach(button => {
    button.classList.toggle("active", button.dataset.certFilter === certFilter);
  });
}

/* ---------- Borang tambah ---------- */
function bindCertPage() {
  cert$("#certIssued").value = certToday();
  cert$("#certExpiry").value = certAddMonths(certToday(), 12);
  cert$("#certRemind").value = DEFAULT_REMIND;

  cert$("#certForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = cert$("#certName").value.trim();
    const expiry = cert$("#certExpiry").value;
    if (!name || !expiry) return;
    certs.push({
      id: certNewId(),
      name,
      issuer: cert$("#certIssuer").value.trim(),
      number: cert$("#certNumber").value.trim(),
      issued: cert$("#certIssued").value || "",
      expiry,
      remind: Number(cert$("#certRemind").value) || DEFAULT_REMIND,
      note: cert$("#certNote").value.trim(),
      history: [],
      createdAt: Date.now()
    });
    saveCerts();
    event.target.reset();
    cert$("#certIssued").value = certToday();
    cert$("#certExpiry").value = certAddMonths(certToday(), 12);
    cert$("#certRemind").value = DEFAULT_REMIND;
    certFilter = "all";
    saveCertUi();
    renderCerts();
  });

  cert$(".cert-filter").addEventListener("click", event => {
    const button = event.target.closest("[data-cert-filter]");
    if (!button) return;
    certFilter = button.dataset.certFilter;
    saveCertUi();
    renderCerts();
  });

  cert$("#certList").addEventListener("click", event => {
    const renew = event.target.closest("[data-renew]");
    if (renew) { openRenewDialog(renew.dataset.renew); return; }
    const edit = event.target.closest("[data-edit-cert]");
    if (edit) openCertDialog(edit.dataset.editCert);
  });

  /* ----- dialog edit ----- */
  cert$("#certEditForm").addEventListener("submit", event => {
    event.preventDefault();
    const cert = certs.find(item => item.id === editingCert);
    const name = cert$("#editCertName").value.trim();
    const expiry = cert$("#editCertExpiry").value;
    if (!cert || !name || !expiry) return;
    Object.assign(cert, {
      name,
      issuer: cert$("#editCertIssuer").value.trim(),
      number: cert$("#editCertNumber").value.trim(),
      issued: cert$("#editCertIssued").value || "",
      expiry,
      remind: Number(cert$("#editCertRemind").value) || DEFAULT_REMIND,
      note: cert$("#editCertNote").value.trim()
    });
    saveCerts();
    editingCert = null;
    cert$("#certDialog").close();
    renderCerts();
  });
  cert$("#closeCertEdit").addEventListener("click", () => { editingCert = null; cert$("#certDialog").close(); });
  cert$("#deleteCert").addEventListener("click", () => {
    if (!editingCert) return;
    if (!confirmCertDelete) {
      confirmCertDelete = true;
      cert$("#deleteCert").textContent = "Tekan sekali lagi untuk padam";
      return;
    }
    certs = certs.filter(item => item.id !== editingCert);
    saveCerts();
    editingCert = null;
    confirmCertDelete = false;
    cert$("#certDialog").close();
    renderCerts();
  });

  /* ----- dialog perbaharui ----- */
  cert$("#renewForm").addEventListener("submit", event => {
    event.preventDefault();
    const cert = certs.find(item => item.id === renewingCert);
    const expiry = cert$("#renewExpiry").value;
    if (!cert || !expiry) return;
    if (!Array.isArray(cert.history)) cert.history = [];
    cert.history.push({ issued: cert.issued || "", expiry: cert.expiry || "", renewedAt: certToday() });
    cert.issued = cert$("#renewIssued").value || certToday();
    cert.expiry = expiry;
    saveCerts();
    renewingCert = null;
    cert$("#renewDialog").close();
    renderCerts();
  });
  cert$("#closeRenew").addEventListener("click", () => { renewingCert = null; cert$("#renewDialog").close(); });
  cert$(".renew-quick").addEventListener("click", event => {
    const button = event.target.closest("[data-months]");
    if (!button) return;
    const from = cert$("#renewIssued").value || certToday();
    cert$("#renewExpiry").value = certAddMonths(from, Number(button.dataset.months));
  });
}

function openCertDialog(id) {
  const cert = certs.find(item => item.id === id);
  if (!cert) return;
  editingCert = id;
  confirmCertDelete = false;
  cert$("#editCertName").value = cert.name || "";
  cert$("#editCertIssuer").value = cert.issuer || "";
  cert$("#editCertNumber").value = cert.number || "";
  cert$("#editCertIssued").value = cert.issued || "";
  cert$("#editCertExpiry").value = cert.expiry || "";
  cert$("#editCertRemind").value = remindDays(cert);
  cert$("#editCertNote").value = cert.note || "";
  cert$("#deleteCert").textContent = "Padam sijil ini";
  cert$("#certDialog").showModal();
  cert$("#editCertName").focus();
}

function openRenewDialog(id) {
  const cert = certs.find(item => item.id === id);
  if (!cert) return;
  renewingCert = id;
  const base = cert.expiry && certDiff(certToday(), cert.expiry) > 0 ? cert.expiry : certToday();
  cert$("#renewTitle").textContent = cert.name || "Sijil";
  cert$("#renewHelp").textContent = `Tempoh sekarang: ${certLabel(cert.issued)} → ${certLabel(cert.expiry)}. Tempoh lama akan disimpan sebagai rekod.`;
  cert$("#renewIssued").value = base;
  cert$("#renewExpiry").value = certAddMonths(base, 12);
  cert$("#renewDialog").showModal();
  cert$("#renewExpiry").focus();
}

/* ---------- Jalankan ---------- */
if (onCertPage) bindCertPage();
document.addEventListener("ft-cloud-data", event => {
  if (event.detail && event.detail.name && event.detail.name !== "certs") return;
  certs = loadCerts();
  renderCerts();
});
renderCerts();

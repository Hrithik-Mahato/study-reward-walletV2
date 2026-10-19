const SUBJECTS = ["MERN Stack", "System Command", "MLT", "BDM"];
const STORAGE_KEY = "studyRewardWallet.v1";
const defaults = { goalPerSubject: 5, missedValuePerConcept: 10, days: {} };
let state = loadState();

const $ = (id) => document.getElementById(id);
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const selectedDate = () => $("selectedDate").value || todayLocal();
const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN", {maximumFractionDigits:0})}`;
const safe = (value) => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return saved && saved.days ? {...defaults, ...saved} : structuredClone(defaults);
  } catch { return structuredClone(defaults); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function getDay(date = selectedDate()) {
  if (!state.days[date]) state.days[date] = { entries: [] };
  if (!Array.isArray(state.days[date].entries)) state.days[date].entries = [];
  return state.days[date];
}
function stats(date = selectedDate()) {
  const entries = getDay(date).entries;
  const earned = entries.reduce((sum, e) => sum + Number(e.reward || 0), 0);
  const bySubject = Object.fromEntries(SUBJECTS.map(s => [s, entries.filter(e => e.subject === s).length]));
  const goal = Number(state.goalPerSubject) || 0;
  const missedConcepts = SUBJECTS.reduce((sum, s) => sum + Math.max(0, goal - bySubject[s]), 0);
  const missedValue = missedConcepts * (Number(state.missedValuePerConcept) || 0);
  return {entries, earned, bySubject, goal, missedConcepts, missedValue, net: earned - missedValue};
}
function render() {
  const date = selectedDate();
  const s = stats(date);
  $("earnedTotal").textContent = money(s.earned);
  $("missedTotal").textContent = money(s.missedValue);
  $("netTotal").textContent = money(s.net);
  $("completedTotal").textContent = s.entries.length;
  $("goalProgress").textContent = `Goal: ${s.goal * SUBJECTS.length} concepts total`;
  $("subjectCards").innerHTML = SUBJECTS.map(subject => {
    const count = s.bySubject[subject], percent = s.goal ? Math.min(100, count / s.goal * 100) : 100;
    const subjectEarned = s.entries.filter(e => e.subject === subject).reduce((a,e) => a + Number(e.reward || 0), 0);
    return `<article class="subject-card"><h3>${safe(subject)}</h3><div class="subject-numbers"><strong>${count}<span style="font-size:.85rem;color:#64766e"> / ${s.goal}</span></strong><span>${money(subjectEarned)}</span></div><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div><small>${count >= s.goal ? "Goal reached ✓" : `${s.goal-count} concept${s.goal-count===1?"":"s"} to goal`}</small></article>`;
  }).join("");
  $("entriesList").innerHTML = s.entries.slice().reverse().map(e => `<div class="entry"><div class="entry-icon">${safe(e.subject.slice(0,1))}</div><div class="entry-main"><strong>${safe(e.name)}</strong><small>${safe(e.subject)} · ${safe(e.difficultyLabel)} · ${safe(e.time)}</small></div><span class="entry-reward">+${money(e.reward)}</span><button class="delete-btn" type="button" data-delete="${safe(e.id)}" aria-label="Delete ${safe(e.name)}">×</button></div>`).join("");
  $("emptyState").classList.toggle("hidden", s.entries.length > 0);
  renderHistory();
}
function renderHistory() {
  const dates = Object.keys(state.days).sort().reverse().slice(0, 7);
  if (!dates.length) { $("historyList").innerHTML = '<p class="muted">Your daily totals will appear here as you log concepts.</p>'; return; }
  $("historyList").innerHTML = dates.map(date => {
    const s = stats(date);
    const d = new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
    return `<div class="history-row"><span>${d} · ${s.entries.length} concepts</span><span><strong>+${money(s.earned)}</strong> <span class="muted">/ missed ${money(s.missedValue)}</span></span></div>`;
  }).join("");
}
function toast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2400);
}

$("selectedDate").value = todayLocal();
$("goalInput").value = state.goalPerSubject;
$("penaltyInput").value = state.missedValuePerConcept;
$("difficulty").addEventListener("change", () => $("customRewardWrap").classList.toggle("hidden", $("difficulty").value !== "custom"));
$("selectedDate").addEventListener("change", render);

$("conceptForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("conceptName").value.trim();
  if (!name) return;
  const difficulty = $("difficulty").value;
  const reward = difficulty === "custom" ? Number($("customReward").value) : Number(difficulty);
  if (!Number.isFinite(reward) || reward < 0) { toast("Enter a valid reward amount."); return; }
  const labels = {"10":"Easy","20":"Medium","30":"Hard",custom:"Custom"};
  const day = getDay();
  day.entries.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    subject: $("subjectInput").value, name, reward,
    difficultyLabel: labels[difficulty] || "Custom",
    time: new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})
  });
  saveState(); $("conceptName").value = ""; render(); toast(`Nice work! ${money(reward)} added to your virtual wallet.`);
});
$("entriesList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;
  const day = getDay();
  day.entries = day.entries.filter(e => e.id !== button.dataset.delete);
  saveState(); render(); toast("Concept entry removed.");
});
$("saveSettings").addEventListener("click", () => {
  const goal = Number($("goalInput").value), penalty = Number($("penaltyInput").value);
  if (!Number.isInteger(goal) || goal < 0 || goal > 100 || !Number.isFinite(penalty) || penalty < 0 || penalty > 100000) {
    toast("Please enter valid goal and virtual value amounts."); return;
  }
  state.goalPerSubject = goal; state.missedValuePerConcept = penalty; saveState(); render(); toast("Your daily rules have been saved.");
});
$("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = "study-reward-wallet-backup.json"; a.click(); URL.revokeObjectURL(url);
  toast("Backup exported. Keep it somewhere safe.");
});

/* =====================================================================
   Import backup (added)
   Flow: pick file -> read text -> JSON.parse -> validate everything ->
   confirm -> save recovery copy -> write localStorage -> only then
   replace the in-memory state and re-render.
   The file is treated as untrusted DATA: it is parsed, never executed,
   and only whitelisted fields are copied into a fresh object.
   ===================================================================== */
const RECOVERY_KEY = `${STORAGE_KEY}.preImport`;   // safety copy of the data replaced by the last import
const MAX_IMPORT_BYTES = 4 * 1024 * 1024;           // localStorage is only ~5 MB, so bigger files cannot be restored
const MAX_REWARD = 100000;                           // same limit as the reward inputs in index.html
const MAX_ERRORS_SHOWN = 4;
let importBusy = false;

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isFiniteInRange = (v, min, max) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
function isRealDate(str) {
  if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
const prettyDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

// Checks the WHOLE file. Returns { ok:true, state, summary } with a brand-new clean object,
// or { ok:false, errors:[...] }. It never touches the live `state` or localStorage.
function validateBackup(data) {
  if (!isPlainObject(data) || !isPlainObject(data.days) || !("goalPerSubject" in data) || !("missedValuePerConcept" in data)) {
    return { ok: false, errors: ["This does not look like a Study Reward Wallet backup. Please choose a file created with “Export history”."] };
  }
  const errors = [];
  const problem = (msg) => { if (errors.length < 50) errors.push(msg); };

  if (!Number.isInteger(data.goalPerSubject) || data.goalPerSubject < 0 || data.goalPerSubject > 100) problem("The daily goal per subject must be a whole number from 0 to 100.");
  if (!isFiniteInRange(data.missedValuePerConcept, 0, MAX_REWARD)) problem(`The missed-goal value must be a number from 0 to ${MAX_REWARD}.`);

  const clean = { goalPerSubject: data.goalPerSubject, missedValuePerConcept: data.missedValuePerConcept, days: {} };
  for (const date of Object.keys(data.days)) {
    if (errors.length >= 50) break;
    if (!isRealDate(date)) { problem(`“${String(date).slice(0, 30)}” is not a valid date (expected YYYY-MM-DD).`); continue; }
    const day = data.days[date];
    if (!isPlainObject(day) || !Array.isArray(day.entries)) { problem(`${date}: the list of concepts is missing or damaged.`); continue; }
    const seenIds = new Set(), entries = [];
    day.entries.forEach((e, i) => {
      const where = `${date}, concept ${i + 1}`;
      if (!isPlainObject(e)) { problem(`${where}: not a valid entry.`); return; }
      if (typeof e.id !== "string" || !e.id || e.id.length > 100) { problem(`${where}: missing or invalid id.`); return; }
      if (seenIds.has(e.id)) { problem(`${where}: duplicate id.`); return; }
      if (typeof e.subject !== "string" || !SUBJECTS.includes(e.subject)) { problem(`${where}: unknown subject.`); return; }
      const name = typeof e.name === "string" ? e.name.trim() : "";
      if (!name || name.length > 200) { problem(`${where}: the concept name is missing or too long.`); return; }
      if (!isFiniteInRange(e.reward, 0, MAX_REWARD)) { problem(`${where}: reward must be a number from 0 to ${MAX_REWARD}.`); return; }
      if (e.difficultyLabel !== undefined && (typeof e.difficultyLabel !== "string" || e.difficultyLabel.length > 30)) { problem(`${where}: invalid difficulty label.`); return; }
      if (e.time !== undefined && (typeof e.time !== "string" || e.time.length > 30)) { problem(`${where}: invalid time.`); return; }
      seenIds.add(e.id);
      entries.push({ id: e.id, subject: e.subject, name, reward: e.reward, difficultyLabel: e.difficultyLabel ?? "Custom", time: e.time ?? "" });
    });
    clean.days[date] = { entries };
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, state: clean, summary: summarizeState(clean) };
}

function summarizeState(st) {
  let concepts = 0, earned = 0;
  const dates = [];
  for (const [date, day] of Object.entries(st.days || {})) {
    const entries = day && Array.isArray(day.entries) ? day.entries : [];
    if (!entries.length) continue;               // empty days are ignored in the counts
    dates.push(date); concepts += entries.length;
    earned += entries.reduce((sum, e) => sum + Number(e.reward || 0), 0);
  }
  dates.sort();
  return { days: dates.length, concepts, earned, firstDate: dates[0] || null, lastDate: dates[dates.length - 1] || null, goal: st.goalPerSubject, penalty: st.missedValuePerConcept };
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("read failed"));
    reader.onabort = () => reject(new Error("read aborted"));
    reader.readAsText(file);
  });
}

// ---- messages ----
function showImportMessage(kind, text, { details = [], actionLabel, onAction } = {}) {
  const box = $("importMessage");
  box.textContent = "";
  box.className = `notice ${kind}`;
  box.setAttribute("role", kind === "error" ? "alert" : "status");
  const body = document.createElement("div"); body.className = "notice-body";
  const p = document.createElement("p"); p.textContent = text; body.appendChild(p);
  if (details.length) {
    const ul = document.createElement("ul");
    details.forEach(d => { const li = document.createElement("li"); li.textContent = d; ul.appendChild(li); });
    body.appendChild(ul);
  }
  if (actionLabel && onAction) {
    const row = document.createElement("div"); row.className = "notice-actions";
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "button secondary"; btn.textContent = actionLabel;
    btn.addEventListener("click", onAction); row.appendChild(btn); body.appendChild(row);
  }
  const close = document.createElement("button");
  close.type = "button"; close.className = "notice-close"; close.setAttribute("aria-label", "Dismiss message"); close.textContent = "×";
  close.addEventListener("click", () => box.classList.add("hidden"));
  box.append(body, close);
  box.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
function showInvalidBackup(errors) {
  const shown = errors.slice(0, MAX_ERRORS_SHOWN);
  const more = errors.length - shown.length;
  if (more > 0) shown.push(`…and ${more} more problem${more === 1 ? "" : "s"}.`);
  showImportMessage("error", "This backup cannot be imported, so your current data was not changed.", { details: shown });
}

// ---- confirmation dialog (falls back to window.confirm if <dialog> is unsupported) ----
const describeRange = (s) => !s.firstDate ? "none" : s.firstDate === s.lastDate ? prettyDate(s.firstDate) : `${prettyDate(s.firstDate)} – ${prettyDate(s.lastDate)}`;
function askToConfirmImport(incoming, current) {
  const row = (label, a, b) => `${label}: ${a} (backup) vs ${b} (this device)`;
  const rows = [
    ["Study days with records", incoming.days, current.days],
    ["Concepts logged", incoming.concepts, current.concepts],
    ["Total earned", money(incoming.earned), money(current.earned)],
    ["Date range", describeRange(incoming), describeRange(current)],
    ["Daily goal per subject", incoming.goal, current.goal],
    ["Missed value per concept", money(incoming.penalty), money(current.penalty)]
  ];
  let warning = "Importing will replace the study history, goals and rules currently saved on this device. It will not merge with them.";
  if (current.concepts > 0) warning = `This device already has ${current.concepts} logged concept${current.concepts === 1 ? "" : "s"}. ${warning}`;
  if (incoming.concepts === 0 && current.concepts > 0) warning += " This backup contains no concepts, so your current history will be cleared.";

  const dialog = $("importDialog");
  if (typeof dialog.showModal !== "function") {
    return Promise.resolve(window.confirm(`${warning}\n\n${rows.map(r => row(...r)).join("\n")}\n\nReplace the data on this device?`));
  }
  $("importDialogWarning").textContent = warning;
  const tbody = $("importCompareBody"); tbody.textContent = "";
  rows.forEach(([label, a, b]) => {
    const tr = document.createElement("tr");
    const th = document.createElement("th"); th.scope = "row"; th.textContent = label;
    const td1 = document.createElement("td"); td1.textContent = a;
    const td2 = document.createElement("td"); td2.textContent = b;
    tr.append(th, td1, td2); tbody.appendChild(tr);
  });
  return new Promise(resolve => {
    dialog.returnValue = "";                      // Esc / closing without a button counts as Cancel
    const onClose = () => { dialog.removeEventListener("close", onClose); resolve(dialog.returnValue === "replace"); };
    dialog.addEventListener("close", onClose);
    dialog.showModal();
  });
}

// ---- safe write ----
const isQuotaError = (e) => !!e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22 || e.code === 1014);

// Order matters: (1) keep a recovery copy of what is there now, (2) write the new data,
// (3) read it back, (4) roll back if anything failed. The live `state` is NOT touched here.
function persistImportedState(newState) {
  let previousRaw;
  try { previousRaw = localStorage.getItem(STORAGE_KEY); }
  catch { return { ok: false, reason: "unavailable" }; }
  const serialized = JSON.stringify(newState);
  try {
    localStorage.removeItem(RECOVERY_KEY);
    if (previousRaw !== null) localStorage.setItem(RECOVERY_KEY, previousRaw);
  } catch (e) { return { ok: false, reason: "recovery", quota: isQuotaError(e) }; }
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
    if (localStorage.getItem(STORAGE_KEY) !== serialized) throw new Error("verification failed");
  } catch (e) {
    try { if (previousRaw === null) localStorage.removeItem(STORAGE_KEY); else localStorage.setItem(STORAGE_KEY, previousRaw); } catch { /* nothing more we can do */ }
    return { ok: false, reason: "write", quota: isQuotaError(e) };
  }
  return { ok: true, previousRaw };
}

function undoImport(previousRaw) {
  try {
    if (previousRaw === null) localStorage.removeItem(STORAGE_KEY); else localStorage.setItem(STORAGE_KEY, previousRaw);
    localStorage.removeItem(RECOVERY_KEY);
  } catch {
    showImportMessage("error", "Could not undo the import because the browser refused to save. Your imported data is still in place.");
    return;
  }
  state = loadState();
  $("goalInput").value = state.goalPerSubject; $("penaltyInput").value = state.missedValuePerConcept;
  render();
  showImportMessage("info", "Import undone. The data that was on this device before the import is back.");
}

async function handleImportFile(file) {
  if (importBusy) return;
  importBusy = true; $("importBtn").disabled = true;
  try {
    if (!file) { showImportMessage("info", "No file was selected. Nothing was changed."); return; }
    if (file.size === 0) { showImportMessage("error", "The selected file is empty, so your current data was not changed."); return; }
    if (file.size > MAX_IMPORT_BYTES) { showImportMessage("error", "The selected file is too large to be a Study Reward Wallet backup. Your current data was not changed."); return; }

    let text;
    try { text = await readFileAsText(file); }
    catch { showImportMessage("error", "The file could not be read. Please try selecting it again. Your current data was not changed."); return; }

    let data;
    try { data = JSON.parse(text.replace(/^\uFEFF/, "")); }     // strip a byte-order mark some editors add
    catch { showImportMessage("error", "The selected file is not valid JSON, so your current data was not changed."); return; }

    const result = validateBackup(data);
    if (!result.ok) { showInvalidBackup(result.errors); return; }

    const confirmed = await askToConfirmImport(result.summary, summarizeState(state));
    if (!confirmed) { showImportMessage("info", "Import cancelled. Your current data was not changed."); return; }

    const saved = persistImportedState(result.state);
    if (!saved.ok) {
      const why = saved.reason === "unavailable" ? "Your browser is blocking local storage for this site."
        : saved.reason === "recovery" ? "There is not enough browser storage to safely keep a copy of your current data first."
        : saved.quota ? "There is not enough browser storage space to save the backup."
        : "The browser could not save the restored data.";
      showImportMessage("error", `Import failed. ${why} Your previous data is still in place and unchanged.`);
      return;
    }

    state = result.state;                         // only now does the app switch to the imported data
    $("goalInput").value = state.goalPerSubject; $("penaltyInput").value = state.missedValuePerConcept;
    render();
    const s = result.summary;
    showImportMessage("success",
      `Backup imported: ${s.concepts} concept${s.concepts === 1 ? "" : "s"} across ${s.days} day${s.days === 1 ? "" : "s"} (${money(s.earned)} earned)` +
      (s.lastDate ? `, latest record ${prettyDate(s.lastDate)}. Use “Study date” to browse other days.` : "."),
      { actionLabel: "Undo import", onAction: () => undoImport(saved.previousRaw) });
  } catch (err) {
    console.error("Import failed:", err);         // details go to the console only, never to the screen
    showImportMessage("error", "Something unexpected went wrong. Your current data was not changed.");
  } finally {
    importBusy = false; $("importBtn").disabled = false; $("importFile").value = "";   // reset so the same file can be picked again
  }
}

$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", (event) => handleImportFile(event.target.files && event.target.files[0]));
$("importFile").addEventListener("cancel", () => showImportMessage("info", "No file was selected. Nothing was changed."));

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}
function updateConnectionStatus() {
  $("offlineBadge").textContent = navigator.onLine ? "● Online / cached" : "● Offline mode";
}
window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);
updateConnectionStatus();
render();

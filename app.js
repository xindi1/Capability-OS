const MODES = {
  dryland: {
    summary: "Build land readiness through terrain, force, rhythm, mobility, and recovery.",
    exposures: [
      ["Walk",5], ["Run",5], ["Sprint",5], ["Jump",5], ["Carry",5], ["Push/Pull",4],
      ["Rotate",5], ["Balance",5], ["Stairs",4], ["Mobility",5]
    ]
  },
  wetland: {
    summary: "Build aquatic readiness through strokes, calm, orientation, and environmental adaptation.",
    exposures: [
      ["Freestyle",4], ["Breaststroke",4], ["Backstroke",3], ["Sidestroke",4], ["Tread",5], ["Float",5],
      ["Sighting",5], ["Direction change",4], ["Entry/exit",5], ["Low visibility",4], ["Temperature",4], ["Recovery",5]
    ]
  },
  amphibious: {
    summary: "Build transition capacity between land and water with composure and situational awareness.",
    exposures: [
      ["Run → Swim",5], ["Swim → Run",5], ["Sand → Water",5], ["Water exit",5], ["Carry + Move",5], ["Breath reset",5],
      ["Footing shift",4], ["Wet mobility",4], ["Orientation",5], ["Energy conserve",5], ["Cold adjust",4], ["Calm test",5]
    ]
  }
};

const ENVIRONMENTS = {
  controlled: { label: "Controlled", multiplier: 1, examples: "pool · gym · track" },
  variable: { label: "Variable", multiplier: 1.14, examples: "grass · hills · sand" },
  dynamic: { label: "Dynamic", multiplier: 1.28, examples: "ocean · lake · trail" }
};
const PURPOSES = { train: "Train", explore: "Explore", recover: "Recover", test: "Test" };
const AXES = ["Challenge", "Novelty", "Transfer", "Enjoyment"];
const QUALITY = ["Efficiency", "Awareness", "Adaptability", "Control", "Calmness", "Recovery"];
const $ = id => document.getElementById(id);

const state = {
  mode: "dryland",
  environment: "controlled",
  purpose: "train",
  startTime: defaultTime(-60),
  endTime: defaultTime(0),
  selected: new Set(),
  axes: Object.fromEntries(AXES.map(q => [q, null])),
  quality: Object.fromEntries(QUALITY.map(q => [q, null])),
  ledgerDay: localDayKey()
};

function init() {
  const savedTheme = localStorage.getItem("capabilityTheme");
  if (savedTheme === "dark") document.body.classList.add("dark");
  $("dateStamp").textContent = new Date().toLocaleDateString([], { month: "short", day: "numeric" });
  document.querySelectorAll(".mode-btn").forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode)));
  document.querySelectorAll(".ladder-step").forEach(btn => btn.addEventListener("click", () => setEnvironment(btn.dataset.level)));
  document.querySelectorAll(".purpose-btn").forEach(btn => btn.addEventListener("click", () => setPurpose(btn.dataset.purpose)));
  $("startTime").value = state.startTime;
  $("endTime").value = state.endTime;
  $("startTime").onchange = updateTimeWindow;
  $("endTime").onchange = updateTimeWindow;
  $("themeToggle").onclick = toggleTheme;
  $("saveBtn").onclick = saveSession;
  $("exportBtn").onclick = exportCSV;
  $("resetBtn").onclick = resetSession;
  $("clearHistory").onclick = clearHistory;
  $("prevDay").onclick = () => moveLedgerDay(-1);
  $("nextDay").onclick = () => moveLedgerDay(1);
  $("todayBtn").onclick = () => { state.ledgerDay = localDayKey(); renderHistory(); };
  $("datePickerBtn").onclick = () => {
    $("ledgerDate").value = state.ledgerDay;
    if ($("ledgerDate").showPicker) $("ledgerDate").showPicker(); else $("ledgerDate").click();
  };
  $("ledgerDate").onchange = () => { if ($("ledgerDate").value) { state.ledgerDay = $("ledgerDate").value; renderHistory(); } };
  renderAll();
}

function setMode(mode) {
  state.mode = mode;
  state.selected.clear();
  document.querySelectorAll(".mode-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.mode === mode));
  renderAll();
}
function setEnvironment(level) {
  state.environment = level;
  document.querySelectorAll(".ladder-step").forEach(btn => btn.classList.toggle("active", btn.dataset.level === level));
  renderScore();
}
function setPurpose(purpose) {
  state.purpose = purpose;
  document.querySelectorAll(".purpose-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.purpose === purpose));
  $("purposeLabel").textContent = PURPOSES[purpose];
  renderScore();
}
function updateTimeWindow() {
  state.startTime = $("startTime").value || defaultTime(-60);
  state.endTime = $("endTime").value || defaultTime(0);
  renderScore();
}
function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem("capabilityTheme", document.body.classList.contains("dark") ? "dark" : "light");
}

function renderAll() {
  $("modeSummary").textContent = MODES[state.mode].summary;
  renderCapabilities();
  renderSliders("axisList", AXES, state.axes);
  renderSliders("qualityList", QUALITY, state.quality);
  renderScore();
  renderHistory();
}
function renderCapabilities() {
  const grid = $("capabilityGrid");
  grid.innerHTML = "";
  MODES[state.mode].exposures.forEach(([name, transfer]) => {
    const btn = document.createElement("button");
    btn.className = "chip" + (state.selected.has(name) ? " active" : "");
    btn.innerHTML = `<span>${name}</span><small>${"★".repeat(transfer)}${"☆".repeat(5-transfer)}</small>`;
    btn.onclick = () => {
      state.selected.has(name) ? state.selected.delete(name) : state.selected.add(name);
      renderCapabilities();
      renderScore();
    };
    grid.appendChild(btn);
  });
}
function renderSliders(containerId, names, target) {
  const list = $(containerId);
  list.innerHTML = "";
  names.forEach(name => {
    const value = target[name];
    const row = document.createElement("div");
    row.className = "quality-row" + (value === null ? " unscored" : "");
    row.innerHTML = `<label>${name}</label><output>${value === null ? "—" : value}</output><input type="range" min="0" max="10" value="${value === null ? 0 : value}" /><div class="quality-actions"><button class="clear-dial" type="button">Clear</button></div>`;
    const input = row.querySelector("input");
    const output = row.querySelector("output");
    input.oninput = () => {
      target[name] = Number(input.value);
      output.textContent = input.value;
      row.classList.remove("unscored");
      renderScore();
    };
    row.querySelector(".clear-dial").onclick = () => {
      target[name] = null;
      input.value = 0;
      output.textContent = "—";
      row.classList.add("unscored");
      renderScore();
    };
    list.appendChild(row);
  });
}

function selectedCapabilityData() { return MODES[state.mode].exposures.filter(([name]) => state.selected.has(name)); }
function averageTransfer() {
  const selected = selectedCapabilityData();
  if (!selected.length) return null;
  return selected.reduce((sum, [,transfer]) => sum + transfer, 0) / selected.length;
}
function scoredAverage(obj) {
  const vals = Object.values(obj).filter(v => v !== null && Number.isFinite(v));
  if (!vals.length) return null;
  return vals.reduce((a,b) => a + b, 0) / vals.length;
}
function calculateScore() {
  const duration = getDurationMinutes();
  const capabilityScore = Math.min(22, (state.selected.size / 6) * 22);
  const axisAvg = scoredAverage(state.axes);
  const qualityAvg = scoredAverage(state.quality);
  const transferAvg = averageTransfer();
  const transferScore = transferAvg === null ? 0 : transferAvg * 5;
  const environmentScore = (ENVIRONMENTS[state.environment].multiplier - 1) * 24;
  const purposeScore = ({train: 4, explore: 5, recover: 3, test: 6})[state.purpose] || 0;
  const timeScore = Math.min(8, duration / 7.5);
  const axisScore = axisAvg === null ? 0 : axisAvg * 1.7;
  const qualityScore = qualityAvg === null ? 0 : qualityAvg * 1.8;
  const raw = capabilityScore + axisScore + qualityScore + transferScore + environmentScore + purposeScore + timeScore;
  return Math.max(0, Math.min(100, Math.round(raw)));
}
function renderScore() {
  const duration = getDurationMinutes();
  const transferAvg = averageTransfer();
  $("timeValue").textContent = formatMinutes(duration);
  $("capabilityCount").textContent = `${state.selected.size} selected`;
  $("scoreValue").textContent = calculateScore();
  $("environmentLabel").textContent = ENVIRONMENTS[state.environment].label;
  $("purposeLabel").textContent = PURPOSES[state.purpose];
  $("transferValue").textContent = transferAvg === null ? "—" : `${transferAvg.toFixed(1)}/5`;
  renderTodayTotals();
}

function saveSession() {
  updateTimeWindow();
  const sessions = getSessions();
  const duration = getDurationMinutes();
  const transferAvg = averageTransfer();
  const session = {
    date: new Date().toISOString(),
    dayKey: localDayKey(),
    mode: state.mode,
    environment: state.environment,
    purpose: state.purpose,
    startTime: state.startTime,
    endTime: state.endTime,
    duration,
    score: calculateScore(),
    transferScore: transferAvg === null ? null : Number(transferAvg.toFixed(2)),
    exposures: [...state.selected],
    capabilities: [...state.selected],
    axes: {...state.axes},
    quality: {...state.quality},
    note: $("sessionNote").value.trim()
  };
  sessions.unshift(session);
  localStorage.setItem("capabilitySessions", JSON.stringify(sessions.slice(0, 300)));
  state.ledgerDay = session.dayKey;
  renderHistory();
  renderTodayTotals();
  showSaveSummary(session);
}
function showSaveSummary(s) {
  const scored = [...summarizeScores(s.axes), ...summarizeScores(s.quality)].slice(0, 4).join(" · ");
  const env = ENVIRONMENTS[s.environment]?.label || capitalize(s.environment);
  const summary = `${formatMinutes(s.duration)} · ${capitalize(s.mode)} · ${env} · ${PURPOSES[s.purpose] || capitalize(s.purpose)}${scored ? " · " + scored : ""}`;
  $("saveSummary").textContent = summary;
  $("saveSummary").hidden = false;
}
function resetSession() {
  state.selected.clear();
  state.axes = Object.fromEntries(AXES.map(q => [q, null]));
  state.quality = Object.fromEntries(QUALITY.map(q => [q, null]));
  state.environment = "controlled";
  state.purpose = "train";
  state.startTime = defaultTime(-60);
  state.endTime = defaultTime(0);
  $("startTime").value = state.startTime;
  $("endTime").value = state.endTime;
  $("sessionNote").value = "";
  $("saveSummary").hidden = true;
  document.querySelectorAll(".ladder-step").forEach(btn => btn.classList.toggle("active", btn.dataset.level === state.environment));
  document.querySelectorAll(".purpose-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.purpose === state.purpose));
  renderAll();
}

function renderHistory() {
  const sessions = getSessions();
  const daySessions = sessions.filter(s => (s.dayKey || isoToLocalDayKey(s.date)) === state.ledgerDay)
    .sort((a,b) => timeToMinutes(a.startTime || "00:00") - timeToMinutes(b.startTime || "00:00"));
  renderLedgerNav();
  renderLedgerTotals(daySessions);
  const list = $("historyList");
  list.innerHTML = "";
  if (!daySessions.length) {
    list.innerHTML = `<div class="empty">No sessions logged for this day.</div>`;
    return;
  }
  daySessions.forEach(s => {
    const item = document.createElement("details");
    item.className = "history-item";
    const duration = s.duration ?? s.time ?? 0;
    const window = s.startTime && s.endTime ? `${s.startTime}–${s.endTime}` : new Date(s.date).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
    const env = s.environment ? ENVIRONMENTS[s.environment]?.label || capitalize(s.environment) : "Controlled";
    const purpose = PURPOSES[s.purpose] || capitalize(s.purpose || "train");
    const exposures = s.exposures || s.capabilities || [];
    const transfer = s.transferScore !== null && s.transferScore !== undefined ? `Transfer ${Number(s.transferScore).toFixed(1)}/5` : "Transfer —";
    const scoreBits = [...summarizeScores(s.axes || {}), ...summarizeScores(s.quality || {})];
    item.innerHTML = `<summary><strong>${window} · ${capitalize(s.mode)} · ${env} · ${purpose} · ${formatMinutes(duration)}</strong><p>${exposures.length ? exposures.join(", ") : "No movement exposure selected"}</p></summary><div class="detail"><p>World readiness ${s.score}/100 · ${transfer}</p>${scoreBits.length ? `<div class="pill-row">${scoreBits.map(bit => `<span class="pill">${bit}</span>`).join("")}</div>` : `<p>No scored dials.</p>`}${s.note ? `<p>${escapeHTML(s.note)}</p>` : ""}</div>`;
    list.appendChild(item);
  });
}
function renderLedgerNav() {
  $("ledgerDate").value = state.ledgerDay;
  const today = localDayKey();
  $("ledgerDateLabel").textContent = state.ledgerDay === today ? "Today" : formatDayLabel(state.ledgerDay);
  $("todayBtn").style.display = state.ledgerDay === today ? "none" : "block";
}
function renderLedgerTotals(daySessions) {
  const totals = { dryland: 0, wetland: 0, amphibious: 0 };
  daySessions.forEach(s => { if (totals[s.mode] !== undefined) totals[s.mode] += Number(s.duration ?? s.time ?? 0); });
  const overall = totals.dryland + totals.wetland + totals.amphibious;
  $("ledgerTotals").innerHTML = `<div><strong>${formatMinutes(overall)}</strong><span>Total</span></div><div><strong>${formatMinutes(totals.dryland)}</strong><span>Dry</span></div><div><strong>${formatMinutes(totals.wetland)}</strong><span>Wet</span></div><div><strong>${formatMinutes(totals.amphibious)}</strong><span>Amph</span></div>`;
}
function renderTodayTotals() {
  const today = localDayKey();
  const totals = { dryland: 0, wetland: 0, amphibious: 0 };
  getSessions().forEach(s => {
    const sessionDay = s.dayKey || isoToLocalDayKey(s.date);
    if (sessionDay === today && totals[s.mode] !== undefined) totals[s.mode] += Number(s.duration ?? s.time ?? 0);
  });
  const overall = totals.dryland + totals.wetland + totals.amphibious;
  $("todayTotal").textContent = formatMinutes(overall);
  $("drylandTotal").textContent = formatMinutes(totals.dryland);
  $("wetlandTotal").textContent = formatMinutes(totals.wetland);
  $("amphibiousTotal").textContent = formatMinutes(totals.amphibious);
}
function moveLedgerDay(delta) {
  const d = parseDayKey(state.ledgerDay);
  d.setDate(d.getDate() + delta);
  state.ledgerDay = toDayKey(d);
  renderHistory();
}

function exportCSV() {
  const sessions = getSessions();
  const rows = [["date","day","mode","environment","purpose","start_time","end_time","duration_minutes","score","transfer_score","movement_exposures","axes","quality","note"]];
  sessions.forEach(s => rows.push([
    s.date,
    s.dayKey || isoToLocalDayKey(s.date),
    s.mode,
    s.environment || "controlled",
    s.purpose || "train",
    s.startTime || "",
    s.endTime || "",
    s.duration ?? s.time ?? "",
    s.score,
    s.transferScore ?? "",
    (s.exposures || s.capabilities || []).join(" | "),
    JSON.stringify(s.axes || {}),
    JSON.stringify(s.quality || {}),
    s.note || ""
  ]));
  const csv = rows.map(row => row.map(cell => `"${String(cell).replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "capability-os-sessions.csv";
  a.click();
  URL.revokeObjectURL(url);
}
function clearHistory() {
  if (!confirm("Clear all saved Capability OS sessions?")) return;
  localStorage.removeItem("capabilitySessions");
  renderHistory();
  renderTodayTotals();
}

function getSessions() { return JSON.parse(localStorage.getItem("capabilitySessions") || "[]"); }
function getDurationMinutes() {
  const start = timeToMinutes(state.startTime);
  const end = timeToMinutes(state.endTime);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return end >= start ? end - start : (24 * 60 - start) + end;
}
function timeToMinutes(value) {
  const [h, m] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}
function defaultTime(offsetMinutes = 0) {
  const d = new Date(Date.now() + offsetMinutes * 60000);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function formatMinutes(minutes) {
  minutes = Math.round(Number(minutes) || 0);
  const h = Math.floor(minutes / 60), m = minutes % 60;
  if (h && m) return `${h}h ${String(m).padStart(2,"0")}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
function localDayKey() { return toDayKey(new Date()); }
function toDayKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function parseDayKey(key) { const [y,m,d] = key.split("-").map(Number); return new Date(y, m - 1, d); }
function isoToLocalDayKey(iso) { const d = new Date(iso); return Number.isNaN(d.getTime()) ? localDayKey() : toDayKey(d); }
function formatDayLabel(key) { return parseDayKey(key).toLocaleDateString([], { month: "short", day: "numeric" }); }
function summarizeScores(obj) { return Object.entries(obj || {}).filter(([,v]) => v !== null && v !== undefined && v !== "").map(([k,v]) => `${k} ${v}`); }
function capitalize(str) { return String(str || "").charAt(0).toUpperCase() + String(str || "").slice(1); }
function escapeHTML(str) { return String(str).replace(/[&<>'"]/g, tag => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[tag])); }

init();

const MODES = {
  dryland: {
    summary: "Build land readiness through terrain, force, rhythm, mobility, and recovery.",
    capabilities: [
      ["Walk",5], ["Run",5], ["Sprint",5], ["Jump",5], ["Carry",5], ["Push/Pull",4],
      ["Rotate",5], ["Balance",5], ["Stairs",4], ["Grass",4], ["Sand",4], ["Mobility",5]
    ]
  },
  wetland: {
    summary: "Build aquatic readiness through strokes, calm, orientation, and environmental adaptation.",
    capabilities: [
      ["Freestyle",4], ["Breaststroke",4], ["Backstroke",3], ["Sidestroke",4], ["Tread",5], ["Float",5],
      ["Sighting",5], ["Direction change",4], ["Entry/exit",5], ["Low visibility",4], ["Temperature",4], ["Recovery",5]
    ]
  },
  amphibious: {
    summary: "Build transition capacity between land and water with composure and situational awareness.",
    capabilities: [
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

const AXES = ["Challenge", "Novelty", "Transfer", "Enjoyment"];
const QUALITY = ["Efficiency", "Awareness", "Adaptability", "Control", "Calmness", "Recovery"];
const state = {
  mode: "dryland",
  environment: "controlled",
  startTime: defaultTime(-60),
  endTime: defaultTime(0),
  selected: new Set(),
  axes: Object.fromEntries(AXES.map(q => [q, 5])),
  quality: Object.fromEntries(QUALITY.map(q => [q, 5]))
};
const $ = id => document.getElementById(id);

function init() {
  const savedTheme = localStorage.getItem("capabilityTheme");
  if (savedTheme === "dark") document.body.classList.add("dark");
  $("dateStamp").textContent = new Date().toLocaleDateString([], { month: "short", day: "numeric" });
  document.querySelectorAll(".mode-btn").forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode)));
  document.querySelectorAll(".ladder-step").forEach(btn => btn.addEventListener("click", () => setEnvironment(btn.dataset.level)));
  $("startTime").value = state.startTime;
  $("endTime").value = state.endTime;
  $("startTime").onchange = () => updateTimeWindow();
  $("endTime").onchange = () => updateTimeWindow();
  $("themeToggle").onclick = toggleTheme;
  $("saveBtn").onclick = saveSession;
  $("exportBtn").onclick = exportCSV;
  $("resetBtn").onclick = resetSession;
  $("clearHistory").onclick = clearHistory;
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
  MODES[state.mode].capabilities.forEach(([name, transfer]) => {
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
    const row = document.createElement("div");
    row.className = "quality-row";
    row.innerHTML = `<label>${name}</label><output>${target[name]}</output><input type="range" min="0" max="10" value="${target[name]}" />`;
    const input = row.querySelector("input");
    const output = row.querySelector("output");
    input.oninput = () => {
      target[name] = Number(input.value);
      output.textContent = input.value;
      renderScore();
    };
    list.appendChild(row);
  });
}

function selectedCapabilityData() {
  return MODES[state.mode].capabilities.filter(([name]) => state.selected.has(name));
}

function averageTransfer() {
  const selected = selectedCapabilityData();
  if (!selected.length) return 0;
  return selected.reduce((sum, [,transfer]) => sum + transfer, 0) / selected.length;
}

function calculateScore() {
  const duration = getDurationMinutes();
  const capabilityScore = Math.min(26, (state.selected.size / 8) * 26);
  const axisAvg = Object.values(state.axes).reduce((a,b) => a + b, 0) / AXES.length;
  const qualityAvg = Object.values(state.quality).reduce((a,b) => a + b, 0) / QUALITY.length;
  const transferScore = averageTransfer() * 5;
  const environmentScore = (ENVIRONMENTS[state.environment].multiplier - 1) * 28;
  const timeScore = Math.min(8, duration / 7.5);
  const raw = capabilityScore + (axisAvg * 1.8) + (qualityAvg * 1.9) + transferScore + environmentScore + timeScore;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function renderScore() {
  const duration = getDurationMinutes();
  $("timeValue").textContent = formatMinutes(duration);
  $("capabilityCount").textContent = `${state.selected.size} selected`;
  $("scoreValue").textContent = calculateScore();
  $("environmentLabel").textContent = ENVIRONMENTS[state.environment].label;
  $("transferValue").textContent = `${averageTransfer().toFixed(1)}/5`;
  renderTodayTotals();
}

function saveSession() {
  updateTimeWindow();
  const sessions = JSON.parse(localStorage.getItem("capabilitySessions") || "[]");
  const duration = getDurationMinutes();
  sessions.unshift({
    date: new Date().toISOString(),
    dayKey: localDayKey(),
    mode: state.mode,
    environment: state.environment,
    startTime: state.startTime,
    endTime: state.endTime,
    duration,
    score: calculateScore(),
    transferScore: Number(averageTransfer().toFixed(2)),
    capabilities: [...state.selected],
    axes: {...state.axes},
    quality: {...state.quality},
    note: $("sessionNote").value.trim()
  });
  localStorage.setItem("capabilitySessions", JSON.stringify(sessions.slice(0, 160)));
  renderHistory();
  renderTodayTotals();
}

function resetSession() {
  state.selected.clear();
  state.axes = Object.fromEntries(AXES.map(q => [q, 5]));
  state.quality = Object.fromEntries(QUALITY.map(q => [q, 5]));
  state.environment = "controlled";
  state.startTime = defaultTime(-60);
  state.endTime = defaultTime(0);
  $("startTime").value = state.startTime;
  $("endTime").value = state.endTime;
  $("sessionNote").value = "";
  document.querySelectorAll(".ladder-step").forEach(btn => btn.classList.toggle("active", btn.dataset.level === state.environment));
  renderAll();
}

function renderHistory() {
  const sessions = JSON.parse(localStorage.getItem("capabilitySessions") || "[]");
  const list = $("historyList");
  list.innerHTML = "";
  if (!sessions.length) {
    list.innerHTML = `<div class="empty">No saved sessions yet.</div>`;
    return;
  }
  sessions.slice(0, 7).forEach(s => {
    const item = document.createElement("div");
    item.className = "history-item";
    const d = new Date(s.date).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const duration = s.duration ?? s.time ?? 0;
    const window = s.startTime && s.endTime ? `${s.startTime}–${s.endTime}` : d;
    const env = s.environment ? ENVIRONMENTS[s.environment]?.label || capitalize(s.environment) : "Controlled";
    const transfer = s.transferScore ? ` · Transfer ${Number(s.transferScore).toFixed(1)}/5` : "";
    item.innerHTML = `<strong>${capitalize(s.mode)} · ${env} · ${s.score}/100 · ${formatMinutes(duration)}</strong><p>${window}${transfer}</p><p>${(s.capabilities || []).join(", ") || "No capabilities selected"}</p>${s.note ? `<p>${escapeHTML(s.note)}</p>` : ""}`;
    list.appendChild(item);
  });
}

function renderTodayTotals() {
  const sessions = JSON.parse(localStorage.getItem("capabilitySessions") || "[]");
  const today = localDayKey();
  const totals = { dryland: 0, wetland: 0, amphibious: 0 };
  sessions.forEach(s => {
    const sessionDay = s.dayKey || isoToLocalDayKey(s.date);
    if (sessionDay === today && totals[s.mode] !== undefined) {
      totals[s.mode] += Number(s.duration ?? s.time ?? 0);
    }
  });
  const overall = totals.dryland + totals.wetland + totals.amphibious;
  $("todayTotal").textContent = formatMinutes(overall);
  $("drylandTotal").textContent = formatMinutes(totals.dryland);
  $("wetlandTotal").textContent = formatMinutes(totals.wetland);
  $("amphibiousTotal").textContent = formatMinutes(totals.amphibious);
}

function exportCSV() {
  const sessions = JSON.parse(localStorage.getItem("capabilitySessions") || "[]");
  const rows = [["date","day","mode","environment","start_time","end_time","duration_minutes","score","transfer_score","capabilities","axes","quality","note"]];
  sessions.forEach(s => rows.push([
    s.date,
    s.dayKey || isoToLocalDayKey(s.date),
    s.mode,
    s.environment || "controlled",
    s.startTime || "",
    s.endTime || "",
    s.duration ?? s.time ?? "",
    s.score,
    s.transferScore ?? "",
    (s.capabilities || []).join(" | "),
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
  localStorage.removeItem("capabilitySessions");
  renderHistory();
  renderTodayTotals();
}

function getDurationMinutes() {
  const start = timeToMinutes(state.startTime);
  const end = timeToMinutes(state.endTime);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  const diff = end >= start ? end - start : (24 * 60 - start) + end;
  return Math.max(0, diff);
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
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${String(m).padStart(2,"0")}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function localDayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function isoToLocalDayKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return localDayKey();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function capitalize(str) { return String(str || "").charAt(0).toUpperCase() + String(str || "").slice(1); }
function escapeHTML(str) { return String(str).replace(/[&<>'"]/g, tag => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[tag])); }

init();

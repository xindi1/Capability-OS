(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CapabilityCanonical = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_NAME = "capability-os";
  const SCHEMA_VERSION = "1.0.0";
  const DOCUMENT_TYPE = "capability-os.backup";
  const MODES = new Set(["dryland", "wetland", "amphibious"]);
  const ENVIRONMENTS = new Set(["controlled", "variable", "dynamic"]);
  const PURPOSES = new Set(["train", "explore", "recover", "test"]);
  const AXES = ["Challenge", "Novelty", "Transfer", "Enjoyment"];
  const QUALITY = ["Efficiency", "Awareness", "Adaptability", "Control", "Calmness", "Recovery"];

  function uuid() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 3 | 8)).toString(16);
    });
  }

  function isDay(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")); }
  function isTime(value) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || "")); }
  function validIso(value) { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
  function clampScore(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 10 ? number : null;
  }
  function scoreMap(source, keys) {
    const input = source && typeof source === "object" ? source : {};
    return Object.fromEntries(keys.map(key => [key, clampScore(input[key])]));
  }
  function dayFromIso(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function stableHash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, "0");
  }
  function legacyFingerprint(raw) {
    const basis = [raw.dayKey || dayFromIso(raw.date), raw.startTime, raw.endTime, raw.mode,
      raw.environment || "controlled", raw.purpose || "train", Number(raw.duration ?? raw.time ?? 0),
      [...(raw.exposures || raw.capabilities || [])].sort().join("|")].join("~");
    return `legacy-${stableHash(basis)}`;
  }
  function normalizeId(raw) {
    const supplied = String(raw.id || "").trim();
    return supplied || legacyFingerprint(raw);
  }
  function normalizeSession(raw, options = {}) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Session must be an object.");
    const now = options.now || new Date().toISOString();
    const localDate = raw.localDate || raw.dayKey || dayFromIso(raw.occurredAt || raw.date);
    if (!isDay(localDate)) throw new Error("Session requires a valid local date (YYYY-MM-DD).");
    const mode = raw.mode || "dryland";
    const environment = raw.environment || "controlled";
    const purpose = raw.purpose || "train";
    if (!MODES.has(mode)) throw new Error(`Unsupported mode: ${mode}`);
    if (!ENVIRONMENTS.has(environment)) throw new Error(`Unsupported environment: ${environment}`);
    if (!PURPOSES.has(purpose)) throw new Error(`Unsupported purpose: ${purpose}`);
    const startTime = isTime(raw.startTime) ? raw.startTime : null;
    const endTime = isTime(raw.endTime) ? raw.endTime : null;
    const durationMinutes = Number(raw.durationMinutes ?? raw.duration ?? raw.time ?? 0);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 0 || durationMinutes > 1440) throw new Error("Invalid duration.");
    const createdAt = validIso(raw.createdAt) ? raw.createdAt : (validIso(raw.date) ? raw.date : now);
    const updatedAt = validIso(raw.updatedAt) ? raw.updatedAt : createdAt;
    const exposures = [...new Set((raw.exposures || raw.capabilities || []).filter(v => typeof v === "string" && v.trim()).map(v => v.trim()))];
    const session = {
      id: normalizeId(raw), localDate, startTime, endTime,
      timeZoneOffsetMinutes: Number.isInteger(raw.timeZoneOffsetMinutes) ? raw.timeZoneOffsetMinutes : null,
      durationMinutes: Math.round(durationMinutes), mode, environment, purpose, exposures,
      axes: scoreMap(raw.axes, AXES), quality: scoreMap(raw.quality, QUALITY),
      score: Number.isFinite(Number(raw.score)) ? Math.max(0, Math.min(100, Math.round(Number(raw.score)))) : null,
      transferScore: raw.transferScore === null || raw.transferScore === undefined ? null : Number(raw.transferScore),
      note: typeof raw.note === "string" ? raw.note : "", createdAt, updatedAt
    };
    if (session.transferScore !== null && (!Number.isFinite(session.transferScore) || session.transferScore < 0 || session.transferScore > 5)) session.transferScore = null;
    return session;
  }
  function toLegacySession(session) {
    const s = normalizeSession(session);
    return {
      id: s.id, date: s.createdAt, createdAt: s.createdAt, updatedAt: s.updatedAt,
      dayKey: s.localDate, localDate: s.localDate, timeZoneOffsetMinutes: s.timeZoneOffsetMinutes,
      mode: s.mode, environment: s.environment, purpose: s.purpose,
      startTime: s.startTime, endTime: s.endTime, duration: s.durationMinutes,
      durationMinutes: s.durationMinutes, score: s.score, transferScore: s.transferScore,
      exposures: [...s.exposures], capabilities: [...s.exposures], axes: {...s.axes}, quality: {...s.quality}, note: s.note
    };
  }
  function parseBackup(data) {
    const rawSessions = Array.isArray(data) ? data : (data && (data.sessions || data.capabilitySessions));
    if (!Array.isArray(rawSessions)) throw new Error("No sessions array found.");
    if (data && data.schema && data.schema.name && data.schema.name !== SCHEMA_NAME) throw new Error("Unsupported schema name.");
    if (data && data.schema && String(data.schema.version || "").split(".")[0] !== "1") throw new Error("Unsupported schema major version.");
    const sessions = [];
    const errors = [];
    rawSessions.forEach((raw, index) => {
      try { sessions.push(normalizeSession(raw)); }
      catch (error) { errors.push({index, message: error.message}); }
    });
    if (errors.length) throw new Error(`${errors.length} invalid session(s): ${errors.slice(0, 3).map(e => `#${e.index + 1} ${e.message}`).join("; ")}`);
    return {sessions, sourceVersion: data && (data.schema?.version || data.version) || "legacy"};
  }
  function newer(a, b) {
    const at = Date.parse(a.updatedAt || a.createdAt || 0) || 0;
    const bt = Date.parse(b.updatedAt || b.createdAt || 0) || 0;
    return bt > at ? b : a;
  }
  function mergeSessions(current, incoming) {
    const byId = new Map();
    let added = 0, updated = 0, unchanged = 0;
    current.map(normalizeSession).forEach(s => byId.set(s.id, s));
    incoming.map(normalizeSession).forEach(s => {
      const prior = byId.get(s.id);
      if (!prior) { byId.set(s.id, s); added += 1; return; }
      const winner = newer(prior, s);
      if (JSON.stringify(winner) === JSON.stringify(prior)) unchanged += 1;
      else { byId.set(s.id, winner); updated += 1; }
    });
    const sessions = [...byId.values()].sort((a, b) => b.localDate.localeCompare(a.localDate) || (b.startTime || "").localeCompare(a.startTime || ""));
    return {sessions, stats: {added, updated, unchanged}};
  }
  function makeBackup(sessions, producerVersion = "1.3.0") {
    return {
      documentType: DOCUMENT_TYPE,
      schema: {name: SCHEMA_NAME, version: SCHEMA_VERSION},
      export: {id: uuid(), exportedAt: new Date().toISOString(), producer: {app: "Capability OS", version: producerVersion}},
      sessions: sessions.map(normalizeSession)
    };
  }

  return {SCHEMA_NAME, SCHEMA_VERSION, DOCUMENT_TYPE, AXES, QUALITY, uuid, normalizeSession, toLegacySession, parseBackup, mergeSessions, makeBackup, legacyFingerprint};
});

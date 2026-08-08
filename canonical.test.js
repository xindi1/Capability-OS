const assert = require("node:assert/strict");
const C = require("./canonical.js");

const legacy = {
  date: "2024-03-01T17:00:00.000Z", dayKey: "2024-02-29", startTime: "23:30", endTime: "00:30",
  duration: 60, mode: "amphibious", environment: "dynamic", purpose: "test",
  capabilities: ["Run → Swim"], axes: {}, quality: {}, note: "historical"
};
const a = C.normalizeSession(legacy);
const b = C.normalizeSession({...legacy});
assert.equal(a.localDate, "2024-02-29", "historical local date must win over UTC timestamp");
assert.equal(a.id, b.id, "legacy identity must be stable across imports");

const older = {...a, updatedAt: "2024-03-01T17:00:00.000Z", note: "old"};
const newer = {...a, updatedAt: "2024-03-02T17:00:00.000Z", note: "new"};
const merged = C.mergeSessions([older], [newer]);
assert.equal(merged.sessions.length, 1);
assert.equal(merged.sessions[0].note, "new");
assert.deepEqual(merged.stats, {added: 0, updated: 1, unchanged: 0});

const backup = C.makeBackup([newer]);
const roundTrip = C.parseBackup(JSON.parse(JSON.stringify(backup))).sessions[0];
assert.deepEqual(roundTrip, C.normalizeSession(newer), "canonical round trip must be lossless");
assert.throws(() => C.parseBackup({sessions: [{...legacy, mode: "space"}]}), /invalid session/i);
assert.throws(() => C.parseBackup({schema: {name: "capability-os", version: "2.0.0"}, sessions: []}), /major version/i);

console.log("Canonical schema tests passed.");

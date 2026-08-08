# Capability OS v1.2 source audit

## Findings and disposition

| Area | v1.2 behavior | Risk | v1.3 disposition |
|---|---|---|---|
| Canonical schema | Export wrapper contains only app/version/exportedAt/sessions; session shape is implicit | Consumers must infer fields and aliases | Explicit `capability-os` schema `1.0.0`, JSON Schema, canonical adapter |
| Historical dates | New saves always use today; edits keep old `date` but overwrite `dayKey` with today | Editing a historical session moves it; historical creation is impossible | User-selectable `localDate`; edit and round-trip preserve it |
| Permanent IDs | Timestamp plus random suffix; missing IDs get random IDs on import/load | Same legacy record gets different IDs on different devices | UUIDs for new sessions; deterministic legacy fingerprints |
| Deduplication | ID map, or an unused date/time fallback for current records; incoming missing IDs are randomized | Duplicate legacy imports accumulate | Stable ID deduplication; deterministic conflict handling |
| Merge safety | Incoming record always overwrites matching ID | Older exports can erase newer edits | Later `updatedAt` wins; counts added/updated/unchanged |
| Versioning | App version `1.2` only | No contract compatibility boundary | Independent semantic schema version and document type |
| Validation | Any array/object is accepted; values and enums are unchecked | Corrupt or incompatible records enter storage | Entire import normalized and validated before mutation |
| Round trip | Aliases vary (`duration/time`, `exposures/capabilities`); metadata is not preserved consistently | Desktop/mobile exchange can lose meaning | Canonical export plus v1.2 aliases in local representation |
| Backup safety | Import mutates storage immediately; no automatic backup | Replace/merge mistakes are hard to recover | Automatic canonical pre-import download |
| Import choices | Merge only | No replace/cancel workflow | MERGE, REPLACE, CANCEL after validation |
| 300-session cap | Save and import silently call `slice(0, 300)` | Older evidence is permanently discarded | No truncation; warning after 300; quota failures preserve prior data |
| Storage integrity | JSON parsing and writes are largely unguarded | Corruption/quota failures can break use | Guarded reads/writes and explicit failure messages |

## Remaining platform limitation

The app still uses browser `localStorage`, which is synchronous and quota-limited. The v1.3 changes make failure non-destructive, but the Research Console should use IndexedDB (or a packaged desktop database) and treat canonical JSON as the portable backup layer.

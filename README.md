# Capability OS v1.3

Capability OS remains a mobile-first, local-first session-capture instrument using the established Land, Water, and Amphibious vocabulary. Version 1.3 establishes the source-side contract required by the desktop Research Console.

## Data contract

- Canonical schema: `capability-os` version `1.0.0`
- Canonical backup type: `capability-os.backup`
- JSON is the authoritative backup and interchange format; CSV remains secondary.
- New records use permanent UUIDs. Legacy records without IDs receive deterministic `legacy-*` identifiers so repeated imports deduplicate across devices.
- `localDate` preserves the user-selected historical calendar date independently of UTC timestamps.
- `createdAt` never changes during editing; `updatedAt` drives deterministic conflict resolution.
- Imports are fully validated before storage and offer MERGE, REPLACE, or CANCEL.
- MERGE uses permanent ID, keeps the record with the later `updatedAt`, and never truncates.
- A canonical JSON backup is automatically downloaded before MERGE or REPLACE when local records exist.
- The former 300-session truncation is removed. At 301+ records the app warns about finite browser storage but discards nothing.
- Canonical exports can be re-imported without loss. The local representation retains v1.2 aliases (`date`, `dayKey`, `duration`, and `capabilities`) for mobile compatibility.

`canonical-schema.json` documents the shared contract. `canonical.js` implements validation, v1.2 migration, canonical export, deterministic legacy identity, and merge behavior.

## Safety boundary

Browser local storage is convenient, not archival storage. Export JSON backups regularly and before clearing site data, changing browsers, or removing the installed web app. A failed write leaves the prior stored value intact and reports the failure.

## Verification

Run `node canonical.test.js` from this directory. The tests cover historical dates, stable legacy IDs, merge conflicts, malformed input rejection, and lossless canonical round trips.

# Public readiness Implementation Plan

> **For agentic workers:** Use focused parallel workers for independent subsystems, test changes before implementation, and review the integrated result. The user authorized proceeding without clarification on 2026-10-27.

**Goal:** Complete locally actionable public-readiness work and attach reproducible evidence without claiming external, legal, physical-device, or deployment approval.

**Architecture:** Preserve the active React/Express app, JSON record schema, single-writer storage, and IndexedDB contracts. Harden existing boundaries rather than changing providers or replacing competition data. Add isolated verification tools and operational instructions.

**Tech Stack:** React/Vite PWA, Express/Node, node:test, Edge/Playwright, PowerShell, Markdown.

**Spec:** [Public release checklist](public-release-checklist.md) and repository AGENTS.md.

## Global constraints

- Work on main; no production push/deployment, real DB mutations, external messages, new provider, or invented legal/operator decisions.
- Preserve report IDs, unknown fields, legacy records, original account/workspace queues, drafts, and existing IndexedDB contracts.
- Authorization is server enforced; session cookies remain HttpOnly; private secrets never reach clients or released files.
- Increment package/lockfile once for this delivered update. Run npm test, build, focused active lint, fixture browser tests, responsive screenshot inspection and PDF review.
- Record uncertainty explicitly. Never check a whole release item based on narrower local evidence.

## Review focus

1. Concurrent password operations must re-read authoritative state before mutation; no lost submissions or stale membership/session creation.
2. Storage failure and crash paths must fail closed without creating an empty replacement or overwriting newer records.
3. Cache cleanup must never remove original drafts/queues and private media must not cross users or teams.
4. Fault/load tools must create disposable data, never contact production or load actual private integration credentials.
5. Public documentation must not invent contact details, retention periods, legal consent, compatibility evidence, or service guarantees.

## Task 1: Authentication and server protection

Files: server.cjs, account-security.cjs, relevant new focused modules and tests.

- [x] Write tests demonstrating event-loop responsiveness, bounded hashing concurrency and state revalidation; run before production edits.
- [x] Replace request-path synchronous password work with bounded asynchronous scrypt while retaining legacy verification and salted hash format.
- [x] Add justified request/body/header/error hardening with regression tests and no break to media/report workflows.
- [x] Run focused tests and report exact results, limitations, and integration needs.

## Task 2: Storage and recovery tools

Files: database.cjs and focused tests; isolated backup/verify/restore tooling under scripts.

- [x] Reproduce missing/corrupt database and crash/write error behavior with disposable directories.
- [x] Prevent established database disappearance from silently initializing empty state; strengthen atomic durability where justified.
- [x] Add consistent backup validation and safe restore-to-new-target tooling plus fault/round-trip tests; never automatically restore over newer records.
- [x] Document single-writer limits and tested recovery mechanics; run focused tests.

## Task 3: PWA installation and private cache boundaries

Files: vite.config.js, PWA assets/offline modules and focused tests as needed.

- [x] Inspect image cache paths and reproduce any cross-account private cache exposure before fixing it.
- [x] Ensure private media isn't persisted in a shared service-worker cache; retain IndexedDB draft/queue media.
- [x] Supply platform-compatible install icons and safe update behavior without changing the brand or adding a team logo.
- [x] Run focused checks and report real-device verification limits honestly.

## Task 4: Local release evidence and operational documentation

Files: scripts readiness/load verification, docs/argus-2 operating guides, checklist status/evidence.

- [x] Build a repeatable isolated multi-team workload with acknowledgement/report count checks, resource/latency results, and explicit limits.
- [x] Review and update safe onboarding, browser support policy, permissions, threat model, incident/restore/release instructions, integration facts, and dependency notices.
- [x] Create an evidence ledger mapping every checklist item to verified, partial, decision, access/device dependent, or future-pilot status with a reason.
- [x] Resolve directly verified defects with test-first changes and integrate worker results.

## Task 5: Integration verification and review

- [x] Increment to a compatible new-feature version, run full unit/API tests, active lint and build.
- [x] Run disposable Edge browser QA and review screenshots at all six required widths, offline recovery, permission flows, presentation controls, and downloads.
- [x] Render/inspect PDF pages; report native PowerPoint and non-Windows device limitations.
- [x] Review final diff and rerun checks affected by fixes. Record exact counts, evidence paths, remaining decisions/access, and no-deployment status.

This plan is execution guidance for the already authorized work, not a request for another approval.

# Supply Chain Risk Report — `Clasue-scout-app`

**Scanned:** `C:\Users\Janik\Documents\GitHub\Scout-App-Updated\Clasue-scout-app`  
**Manifests read:** `package.json`, `package-lock.json`  
**Scanned at:** 2026-10-26T00:48:32+00:00  
**Direct dependencies:** 22 (npm 22)

## Summary

- **No known advisory affects any of the 22 direct dependencies**, checked at the versions this project resolves.
- No known advisory affects any of the 683 registry-verified transitive packages at their locked versions.
- 8 of 22 dependencies carry at least one finding, 3 of which reach production.
- Weakest coverage: **Publisher concentration**, established for 11 of 22; the Coverage section lists every criterion.

## Production dependencies

9 dependencies are declared as runtime dependencies and ship in the built artifact. Advisory status is given for every one, clean or not.

| Dependency | Version | Advisories | Other findings |
|---|---|---|---|
| `concurrently` | 9.2.5 | none known | — |
| `cors` | 2.8.6 | none known | — |
| `express` | 5.2.1 | none known | — |
| `firebase` | 12.13.0 | none known | — |
| `jspdf` | 4.2.1 | none known | Publisher concentration |
| `pptxgenjs` | 4.0.1 | none known | Publisher concentration |
| `react` | 19.2.6 | none known | — |
| `react-dom` | 19.2.6 | none known | — |
| `web-push` | 3.6.7 | none known | Publisher concentration |

## Findings

### Reaches production

| Dependency | Version | Weekly downloads | Findings |
|---|---|---|---|
| `jspdf` | 4.2.1 | 9,890,457/wk | single human publisher (mrjameshall) of 1 listed |
| `pptxgenjs` | 4.0.1 | 2,567,615/wk | single human publisher (brentely) of 1 listed |
| `web-push` | 3.6.7 | 6,471,000/wk | single human publisher (marco-c) of 1 listed |

### Build-time only

Declared as development dependencies. A compromise here reaches build and CI hosts rather than users of the shipped artifact.

| Dependency | Version | Weekly downloads | Findings |
|---|---|---|---|
| `@types/react` | 19.2.14 | 112,703,929/wk | single human publisher (types) of 1 listed |
| `@types/react-dom` | 19.2.3 | 96,961,133/wk | single human publisher (types) of 1 listed |
| `fake-indexeddb` | 6.2.5 | 5,194,125/wk | single human publisher (dumbmatter) of 1 listed |

## Upstream repository and CI hygiene — OpenSSF Scorecard

These criteria describe each dependency's own repository, not the audited
project. Remediation, where any exists, is upstream.

### Build-time only

Declared as development dependencies. A compromise here reaches build and CI hosts rather than users of the shipped artifact.

| Dependency | Version | Weekly downloads | Findings |
|---|---|---|---|
| `eslint-plugin-react-hooks` | 7.1.1 | 63,108,579/wk | Binary-Artifacts scores 9/10 (below 10) |
| `vite` | 8.3.4 | 127,196,570/wk | Binary-Artifacts scores 1/10 (below 10) |

## Transitive advisories

No known advisory affects any of the 683 registry-verified packages beyond the direct set (resolved by `package-lock.json`), at the locked versions. Only advisories were checked at this depth; every other criterion in this report describes direct dependencies only.

## Informational

Measured, not flagged.

- **CI token permissions**: median 0/10 across 15 scored dependencies; 9 score below 6. Not flagged — this measures whether CI workflows declare least-privilege tokens, which tracks project maturity rather than the likelihood of malicious code being published.
- **Changes reviewed by a second person**: median 8/10 across 16 scored dependencies; 5 score below 6. Not flagged — this measures the share of recent commits reviewed by a second person, which is low for most small single-maintainer projects and largely restates publisher concentration.
- **Publish provenance**: 10 of 22 publish with build provenance.
  Without: `@eslint/js`, `@types/react`, `@types/react-dom`, `cors`, `eslint`, `eslint-plugin-react-hooks`, `fake-indexeddb`, `firebase`, `globals`, `jspdf` and 2 more
- **Security policy published**: 15 of 22 publish a security policy.
  Without: `concurrently`, `fake-indexeddb`, `globals`, `json-server`, `pptxgenjs`, `vite-plugin-pwa`, `web-push`
- **Download volume**: established for 22 of 22; median 63,108,579/week. Lowest: `json-server` (207,920/wk), `@playwright/cli` (725,127/wk), `pptxgenjs` (2,567,615/wk).

## Coverage

What was and was not measured, per criterion.

| Criterion | Tier | Assessed | Flagged | Not assessable |
|---|---|---|---|---|
| Known advisories | A | 22/22 | 0 | 0 |
| Deprecated or yanked | A | 22/22 | 0 | 0 |
| Repository archived | A | 22/22 | 0 | 0 |
| Maintenance activity | A | 22/22 | 0 | 0 |
| Publisher concentration | B | 11/22 | 6 | 11 |
| Install-time script execution | B | 22/22 | 0 | 0 |
| Dangerous CI workflow | scorecard | 15/22 | 0 | 7 |
| CI token permissions | scorecard | 15/22 | 0 | 7 |
| Checked-in binaries | scorecard | 16/22 | 2 | 6 |
| Changes reviewed by a second person | scorecard | 16/22 | 0 | 6 |
| Publish provenance | info | 22/22 | 0 | 0 |
| Security policy published | info | 22/22 | 0 | 0 |
| Download volume | info | 22/22 | 0 | 0 |

## Not assessable

**Checked-in binaries**

- 6 dependencies — OpenSSF Scorecard has no report for this repository: `concurrently`, `eslint-plugin-react-refresh`, `jspdf`, `react`, `react-dom`, `vite-plugin-pwa`

**Changes reviewed by a second person**

- 6 dependencies — OpenSSF Scorecard has no report for this repository: `concurrently`, `eslint-plugin-react-refresh`, `jspdf`, `react`, `react-dom`, `vite-plugin-pwa`

**Dangerous CI workflow**

- 6 dependencies — OpenSSF Scorecard has no report for this repository: `concurrently`, `eslint-plugin-react-refresh`, `jspdf`, `react`, `react-dom`, `vite-plugin-pwa`
- 1 dependency — Scorecard could not evaluate Dangerous-Workflow (score -1): `pptxgenjs`

**Publisher concentration**

- 10 dependencies — publishes from CI with provenance, so the effective publisher set is whoever can merge to the release branch — not externally observable: `@playwright/cli`, `@vitejs/plugin-react`, `concurrently`, `eslint-plugin-react-refresh`, `express`, `json-server` and 4 more
- 1 dependency — every listed maintainer looks automated; the human population is unknown: `eslint-plugin-react-hooks`

**CI token permissions**

- 6 dependencies — OpenSSF Scorecard has no report for this repository: `concurrently`, `eslint-plugin-react-refresh`, `jspdf`, `react`, `react-dom`, `vite-plugin-pwa`
- 1 dependency — Scorecard could not evaluate Token-Permissions (score -1): `pptxgenjs`

## Method and caveats

- cache directory ownership was not verified: os.getuid is POSIX-only, so a cache at C:\Users\Janik\AppData\Local\Temp\argus-release-review-20261026\cache owned by another user would not be detected on this platform. Keep the cache under your own user profile, or pass --cache with a private path.
- gh is not authenticated. GitHub allows 60 requests/hour unauthenticated against 5000 authenticated, so repository signals may be unassessable.
- Repository-level criteria (archived, maintenance activity, security policy, and the Scorecard checks) describe the source repository rather than the package. 22 dependencies resolve to 19 distinct repositories, so one repository can appear as several findings. Shared: github.com/DefinitelyTyped/DefinitelyTyped, github.com/eslint/eslint, github.com/react/react
- Optional tooling detected: npm. Not installed, so not used: bundler-audit, cargo-audit, osv-scanner, pip-audit.
- Every criterion except advisories applies to direct dependencies only. The 683 registry-verified packages resolved by package-lock.json were checked for known advisories at their locked versions, and for nothing else.
- HTTP sources: 1 fetched, 181 served from cache (oldest 0.3h old), 0 refetched as stale, 0 unavailable offline, 0 errors.

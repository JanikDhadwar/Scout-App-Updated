# Security test results

Candidate date: 2026-10-28. Baseline before fixes: Argus 5.11.0 at `4c96481`.

## Baseline evidence

- `npm audit --omit=dev`: 0 vulnerabilities.
- `npm audit`: 4 Low, all in the development/build `vite-plugin-pwa`/Workbox/`deepmerge` chain; 0 Moderate/High/Critical.
- `npm test`: 177/177 passed before this increment.
- Harmless requests to the public root, health and auth-me routes returned Cloudflare 403. No bypass or write traffic was attempted.

## Final verification

- `npm test`: 184/184 passed.
- `node --test security-inputs.test.cjs mfa-service.test.cjs mfa-api.test.cjs`: 7/7 passed (included in the full count).
- `npm run lint:active`: passed with no errors or warnings.
- `npm run build`: passed; Vite generated the production PWA.
- `npm run security:scan`: passed across 540 tracked files and the built frontend.
- `npm run test:accessibility`: 47 desktop/mobile states, zero violations, zero unnamed generic controls, zero missing controlled IDs, and zero page errors. Axe reported several manual-review `incomplete` checks; these are not automated violations.
- `npm audit --omit=dev`: zero vulnerabilities.
- `npm audit`: four Low development-only advisories in the Workbox build chain. The offered fix is an unsafe major downgrade and was not applied.
- `bash -n ../deploy.sh` and `git diff --check`: passed.
- A path-only Git history search found no candidate private-key, GitHub token, or AWS access-key files. This was a focused pattern scan, not proof that arbitrary historical secrets are absent.
- `npm run lint`: failed with 52 errors and 15 warnings in pre-existing inactive/legacy source. Active production lint passes; rules and unrelated legacy files were not weakened to manufacture a pass.

- `npm run test:browser`: 25/25 workflows passed, including offline drafts/synchronization, cross-role access, ownership/handoffs, mobile layouts, account recovery, MFA enrollment and recovery-code sign-in.

## Bounded disposable capacity checks

The localhost workload used synthetic data, immutable retry checks, foreign-team rejection checks and four reports per simulated client. No production URL or database can be supplied to the runner.

| Clients | Confirmed reports/s | Report p95 | Health p95 | Errors | Integrity |
| ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 155.74 | 6.72 ms | 2.90 ms | 0 | Passed |
| 5 | 451.22 | 12.87 ms | 12.24 ms | 0 | Passed |
| 10 | 587.53 | 17.73 ms | 9.49 ms | 0 | Passed |
| 20 | 452.06 | 32.68 ms | 27.81 ms | 0 | Passed |
| 30 | 496.61 | 40.37 ms | 41.76 ms | 0 | Passed |

These short loopback results are not a production capacity promise. CPU/RSS and long-duration event-loop behavior were not measured, so the operational checklist still requires a rehearsal on the actual 4 GB host.

## Limitations

Tests use disposable synthetic databases and loopback servers. They do not validate production credentials, Cloudflare configuration, public origin isolation, physical phones, event Wi-Fi, native PowerPoint rendering, long-duration soak behavior or a real off-site recovery drill.

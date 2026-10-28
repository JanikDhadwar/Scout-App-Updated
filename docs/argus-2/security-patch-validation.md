# CSV patch differential validation

Validated 2026-10-28 for the whitespace/control-prefix CSV export fix. This is a narrow runtime proof for `reportsCsv`, not a security certificate for the whole application.

The post-patch-validation runner pinned vulnerable base `55251213efb343e3703b25de77cb42d626ad9a6e` and binary patch SHA-256 `35f8e8972ffeeffdb0a846ce13dd13e76f0da81fba5797184f72fdae2fa64c3a`. It created isolated temporary worktrees, applied only the CSV source/test patch, and left the main checkout and real data untouched. Validation worktrees were removed afterward.

Eight checks ran on both base and patch:

| Check | Observation |
| --- | --- |
| Benign control | Valid notes and numeric zero export on both versions |
| Original exploit | Leading space/tab before formula prefix fails the safe assertion on base and passes on patch |
| Control-character variant | A NUL-prefixed formula in scout metadata fails on base and passes on patch |
| Header variant | A newline-prefixed formula in the generated question header fails on base and passes on patch |
| Preserved behavior | Ordinary quoted/newline text and zero produce byte-identical selected output |
| Non-security regression | Event filtering and valid data behavior pass on both versions |
| Adjacent security | Records and Object.prototype are not mutated on either version |
| Real suite | The report-history/CSV suite passes on both revisions, including the added patched regression |

Exploit/variant helpers emitted the required reached marker immediately before the safety assertion. Their revision sides were hidden and executed in randomized order. The baseline failures were the intended assertions, not missing imports/build dependencies.

Runner assessment: **complete**, findings `[]`, gaps `[]`, `human_review_required: true`. The result does not replace release-owner/human review, native spreadsheet importer verification, or the remaining public-release gates.

Private local evidence directory: `C:/Users/Janik/AppData/Local/Temp/argus-csv-ppv-eb3f65e424294ea1b9dc476f263af7e0`. It contains the pinned plan/patch, content-addressed helper copies, per-side outputs, `results/result.json`, and `results/report.md`. Only synthetic values were used.

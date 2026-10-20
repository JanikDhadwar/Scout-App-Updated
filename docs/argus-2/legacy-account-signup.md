# Legacy account records and sign-up

October 20, 2026: investigated the generic account-creation error after confirming production had activated release 724818b. The local preserved database contains a user record without a string username. Authentication searched every username using `toLowerCase()` without checking its type, causing an HTTP 500 before either sign-up or sign-in could finish.

The lookup now skips records without a string username. It preserves those records and their unknown fields unchanged, and continues matching registered usernames case-insensitively. No database migration or deletion is needed.

Added an unnamed legacy user to the temporary API test database and reproduced a 500 on account creation before the fix. The fixed API creates an account, keeps the legacy record unchanged and passes existing login, duplicate-name, permissions and data-preservation checks. All 66 tests and the production build passed. Focused ESLint passed with existing unused binding exceptions; `git diff --check` passed. No production accounts were created or changed. Production database contents and logs were not available to confirm this is the sole cause of the screenshot error. This patch has not been pushed or deployed.

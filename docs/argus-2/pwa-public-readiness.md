# PWA public readiness evidence

Reviewed 2026-10-27. This is local implementation evidence, not a physical-device compatibility claim.

## Changes

- Removed the service worker's generic image runtime cache. Previously every image request matched, including authenticated/private or third-party URLs; CacheStorage had no account/workspace key. Public build images remain precached. Report/draft media stays under the existing scoped IndexedDB contracts.
- Worker activation deletes all legacy `scout-images` and `argus-images-*` caches, including the most recent legacy build cache. It does not call IndexedDB deletion or remove unrelated caches.
- Added raster 192/512 icons, a separate safe-area maskable 512 icon, and an Apple touch 180 icon derived from the existing Argus SVG. The SVG/brand is unchanged. `scripts/generate-app-icons.cjs` reproduces these assets with local Edge rendering; generation requires Edge and the existing Playwright dependency.
- Explicit app updates now wait for draft storage writes to commit, including writes from unmounted forms and edits queued while the update waits. Failed snapshots prevent reload and remain retryable. Pressing the existing update action again retries failed storage writes; a persistent storage failure shows an explanatory message and preserves pending evidence.

## Verification

- `node --test src/argus/draft-persistence.test.js pwa-readiness.test.cjs`: 6 passed, zero failed.
- PWA tests build the actual candidate into a disposable temp directory, execute its emitted worker registration/activation logic, and verify private/remote images have no runtime cache route, public shell remains precached, old image caches are deleted, unrelated caches remain, and all raster/touch assets have matching PNG dimensions.
- Before the fix, the generated-worker tests reproduced the private-image route match, retained current image cache, and missing raster install assets. All three failed with those specific assertions, then passed after implementation.
- Draft tests cover pending writes, edits added during an update wait, storage failure, explicit repeated retry, corrected snapshots, and failures on a second scoped form.
- Focused ESLint on the modified Vite/app/draft modules and PWA test: exit 0.
- Maskable PNG visually inspected; existing lowercase Argus `a` is centered with padding.

## Limits

- An existing deployed worker needs an installed/activated update before legacy caches are removed. No production deployment was performed.
- Native iOS/iPadOS/Android installation, managed Chromebooks, Safari/Firefox, touch, operating-system suspension, and platform storage eviction require their real-device matrix checks.
- These tests do not establish native App Store/Play Store distribution or background upload support.
- The draft barrier protects the explicit Argus update action. Browser/site-data clearing, forced OS termination, or manual reload before a transaction commits remain platform limits; a failed storage write must never be described as saved.

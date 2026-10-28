# Version-pinned supplemental notices

These are captured upstream license notices for exact locked packages that do not ship a top-level LICENSE/NOTICE file. They supplement the installed-package inventory; they do not grant a license to Argus or certify all legal obligations.

`manifest.json` records package name/version, its declared SPDX license, npm tarball integrity from the lockfile, the captured text SHA-256, primary-source URLs, and the reason those sources apply. `scripts/dependency-notices.cjs` regenerates the public notices entirely offline from installed packages and these checked-in captures. It validates every supplement before writing output. A new dependency version is not covered automatically and reopens a review gap.

Reviewed/captured 2026-10-27:

| Packages | Evidence |
| --- | --- |
| esrecurse 4.3.0; imurmurhash 0.1.4; is-module 1.0.0; nested isarray 1.0.0 | Complete license grants already present in the exact installed README. README hashes and tarball integrity are recorded. |
| @humanfs/types 0.15.0 | Exact npm gitHead contains the matching types package and its Apache-2.0 declaration. The same revision's standard Apache-2.0 text is supplied from packages/core/LICENSE; this does not assume a different license for types. |
| @rollup/rollup-win32-x64-gnu and -msvc 4.60.3 | Exact npm gitHead's full core and bundled-third-party LICENSE.md. |
| @rolldown/binding-win32-x64-msvc 1.2.14 | Official v1.2.14 tag resolved to an immutable commit; complete MIT root license. |
| http_ece 1.2.0 | Exact npm gitHead's complete MIT license. |
| filelist 1.0.6; jake 10.9.4 | Official matching version tags resolved to immutable commits; Apache-2.0 license plus original installed source copyright headers, including their original spelling. |
| is-regexp 1.0.0 | Official v1.0.0 tag resolved to immutable commit; complete MIT notice. |
| keyv 4.5.4 | Exact version-bump commit, matching package version and SHA-256 comparison of the installed src/index.js; full MIT notice retains Luke Childs and Jared Wray attribution. |
| natural-compare 1.4.0 | MIT declaration and copyright in the exact package README; full license captured from the author-hosted URL that README links. The URL is mutable; the captured snapshot is pinned by SHA-256 and is not represented as proof of its historical contents. |

Updating a supplement requires checking the new package identity, published license declaration, source/version correspondence, relevant NOTICE files, and captured text. Record the new provenance and checksum. Do not edit copyright holders or fabricate a license grant merely to clear an inventory warning.

The remaining `https@1.0.0` gap is explicit in `docs/argus-2/dependency-notice-gaps.txt`: the npm artifact contains only package.json, declares ISC, and supplies no README, license text, repository, or code. No notice was invented from its author field. Obtain authoritative clarification or a reviewed dependency change before treating that item as cleared.

Platform-specific packages absent from the current installation are not presented as reviewed installed files. Regenerate on the actual distribution/build platform and inspect new gaps. These captures cover only their exact recorded packages; they do not license optional native packages with other names or versions.

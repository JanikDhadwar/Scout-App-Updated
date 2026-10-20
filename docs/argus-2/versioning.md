# Argus release numbers

The redesigned app starts at **4.0.0**. This establishes a clear product release baseline; earlier changes were not consistently numbered, so it does not claim an exact count of historical releases.

Use three numbers: **major.minor.patch**.

- **Patch:** fixes and small refinements, such as fixing sign-up. Example: 4.0.0 → 4.0.1.
- **Minor:** a new feature or substantial improvement within the current app. Example: 4.0.1 → 4.1.0. Reset the patch number to zero.
- **Major:** a substantial app overhaul, a major workflow change or an incompatible data/API change. Example: 4.3.2 → 5.0.0. Reset both other numbers to zero.

This is product versioning using the familiar three-number format. Major releases may include a significant redesign even if the APIs remain compatible. Any incompatible changes must still be documented, with migrations that preserve scouting records.

`Clasue-scout-app/package.json` is the version source. The sidebar, signed-out page, workspace footer, health API and generated release metadata all read it. The lockfile must match. Unique build IDs and commit hashes remain separate: they identify the precise deployed build, including repeated builds of the same version, and continue to control offline cache refresh.

Before publishing a release, choose its number based on the combined changes since the last published version, then run one of these from `Clasue-scout-app`:

```bash
npm version patch --no-git-tag-version
npm version minor --no-git-tag-version
npm version major --no-git-tag-version
```

Run only the command matching the release. It updates package.json and package-lock.json together. Run the required tests/build, then commit and push only with deployment authorization. Do not bump the number for each draft edit or test build. Future fixes after 4.0.0 ships should start at 4.0.1; the sign-up repair included before that release remains part of 4.0.0.

## Validation

The API regression test checks that health reports the package version. Validation for this change includes the full test suite, production build, focused ESLint and inspecting generated release metadata for 4.0.0. No production push or deployment is part of this change.

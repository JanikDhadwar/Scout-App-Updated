# Argus release numbers

The redesigned app starts at **4.0.0**. This establishes a clear product release baseline; earlier changes were not consistently numbered, so it does not claim an exact count of historical releases.

Use three numbers: **major.minor.patch**.

- **Patch:** fixes and small refinements, such as fixing sign-up. Example: 4.0.0 → 4.0.1.
- **Minor:** a new feature or substantial improvement within the current app. Example: 4.0.1 → 4.1.0. Reset the patch number to zero.
- **Major:** a substantial app overhaul, a major workflow change or an incompatible data/API change. Example: 4.3.2 → 5.0.0. Reset both other numbers to zero.

This is product versioning using the familiar three-number format. Major releases may include a significant redesign even if the APIs remain compatible. Any incompatible changes must still be documented, with migrations that preserve scouting records.

`Clasue-scout-app/package.json` is the version source. The sidebar, signed-out page, workspace footer, health API and generated release metadata all read it. The lockfile must match. Unique build IDs and commit hashes remain separate: they identify the precise deployed build, including repeated builds of the same version, and continue to control offline cache refresh.

Every update must change the version number, however small. Choose the increment based on the size of the delivered change, then run one of these from `Clasue-scout-app`:

```bash
npm version patch --no-git-tag-version
npm version minor --no-git-tag-version
npm version major --no-git-tag-version
```

Run only the command matching the update. It updates package.json and package-lock.json together. A single feature and its implementation fixes share one increment while being developed; every subsequent delivered change gets a new version. Run the required tests/build, then commit and push only with deployment authorization.

## Validation

The API regression test checks that health reports the package version. All 66 tests, the production build and focused ESLint passed. Generated release metadata reports 4.0.0. All 28 fixture-only Edge browser checks passed, including offline recovery, permissions, assignments, picklists, presentation controls and real downloads. Dashboard screenshots at 1440, 1280, 1024, 768, 390 and 360px show the version label without document overflow. No production push or deployment was performed by the agent.

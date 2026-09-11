# FRC Scout local app

See [the Debian setup guide](../README.md) for installation, automatic GitHub
updates, startup commands, data storage, and logs.

The entry point imports `src/frc-scout-local.jsx`. Firebase is not active.

## Conditional questions

In **Forms**, create or edit a form. Under a question, use **When to show this
question → Add condition**, choose an earlier question, then a comparison.

- Any question: is answered / is not answered.
- Yes/No and multiple choice: equals / does not equal a selected answer.
- Text: equals / does not equal / contains (case-insensitive).
- Numbers and ratings: equals, does not equal, greater than, less than, at least,
  or at most. Zero counts as an answer.
- Photos and drawings: whether an image/drawing has been provided.

Example: show **Climb height** only when **Attempted a climb?** equals **Yes**.
Add several conditions and choose whether **all** or **any** must match.
Remove every condition to make a question always visible again.

Rules can reference only questions above them. If you reorder/delete a source
or change its type/options, saving will explain which rule needs fixing.
Hidden source questions never trigger other questions, even “is not answered.”
Hidden questions are not required, and their old answers are cleared when the
branch changes and excluded from submitted reports. Existing forms work as before.

Run `npm test` for server and condition tests; `npm run build` for a production build.

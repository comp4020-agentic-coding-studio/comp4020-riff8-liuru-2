# The spec

The [final project brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/)
and its spec are on the course website, along with the specs for crits 8, 9 and
10, which run in this repo. The brief poses the problem; the spec is the fixed
contract.

## What ships

`invariants.test.ts` checks the two things the course relies on:

- `/` answers with a 200, which is what the deploy and the crit capture read
- `/readme/` publishes `README.md`. Markdown renderers all differ slightly, so
  it checks the README's headings rather than every word: each one has to
  appear, in order, in the HTML the server sends, since no script runs. Render
  it however you like, as long as it's there in full; the marker reads it there.

Both run against the **running** app over HTTP, so they hold whatever it's built
with. In CI that app is the image your `Dockerfile` builds, started with a
throwaway `/data`, and a red run blocks the deploy. Locally, start the app
however you run it and `pnpm check` finds it at `APP_URL` (default
`http://localhost:8080`). Keep them; don't delete them.

## Your checks

Everything else in `spec/` is yours to write. Any `spec/*.test.ts` runs with
`pnpm check`, against the same running app. Some lines of a spec only a person
can judge; those are left to the crit and the marker.

This wall's own checks:

- `trace.test.ts`: the plain form keeps a real trace and drops garbage
- `live.test.ts`: JSON posts, the live stream, static routes, malformed headers
- `replies.test.ts`: replies persist under their thought, in order, validated,
  rendered as text, and kept away from the model
- `recovery.test.ts`: retried posts are stored once, and a reconnecting page
  replays exactly what it missed (or is told to reload its view)
- `twins.test.ts`, `oracle.test.ts`: the two glasses stay distinct, and the
  model's memory and loop stay bounded (against test doubles)

Test files run in parallel against one app, so a test never assumes it is
the only one posting.

At a crit, a green `check` job is half the shipped mark, but it's never the
judgement of the work: your tutor checks what you deployed against the published
spec.

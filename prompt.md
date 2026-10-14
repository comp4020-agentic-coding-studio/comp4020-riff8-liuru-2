# 六如 — Echoes Across Time

## Status

This is a proposed interaction direction, not an implementation. Nothing in
this document has been built. The current site — six kinds, the human orb,
the model orb, SQLite storage, the SSE live layer — is working and must stay
working while this is evaluated. Do not implement this brief without a
separate, explicit decision to proceed.

## What the site is today

六如 is a shared wall where a visitor leaves a short thought (at most 240
characters) tagged as one of six similes from the Diamond Sūtra: dream,
illusion, bubble, shadow, dew, lightning. Every stored thought is a light in
a crystal ball (`public/js/orb.js`); a visitor turns the glass to find older
lights, fainter with age, with no popularity sort and no accounts. A second,
smaller orb (`public/js/oracle-orb.js`, driven by `public/js/oracle.js` and
`public/js/oracle-worker.js`) holds thoughts a small language model
(LFM2.5-230M, running in the visitor's own browser) imagines from what
people left; its fragments are never stored and never mixed with human
words. `src/server.ts` is a plain `node:http` server with three meaningful
routes (`POST /trace`, `GET /traces`, `GET /events`) over one SQLite table
(`src/db.ts`), deployed as a single 256 MB Fly machine with one volume.
`GET /events` is a Server-Sent Events stream: every new trace is broadcast,
without its visitor id, to every open page, so the glass fills while you
watch (decision record 0002). A visitor is identified only by a long-lived,
anonymous cookie (`visitorId`), which is how the wall marks "yours" without
an account.

Today, every thought is a self-contained utterance. Nothing a visitor leaves
ever references, replies to, or is shaped by anything another visitor left.
The wall is a collection, not a conversation.

## The idea: Echoes Across Time

Transform the wall from a passive collection of anonymous thoughts into an
asynchronous, cross-time multiplayer experience, without turning it into a
comment section.

A visitor can encounter a thought left by someone who visited earlier,
respond to it in a way that stays legibly *about* that thought, and leave
before anyone else ever sees the connection form. A later visitor — hours,
days, or weeks on — can discover that an earlier thought drew a response,
and continue the chain. Two people need never be on the wall at the same
moment for this to work; the wall itself is what carries the exchange across
the gap. When two visitors do happen to be present together, they watch a
connection appear in real time, the same way the existing orb already shows
a stranger's thought falling into the glass.

The result should still feel like 六如: quiet, passing, unranked, unnamed.
Not a reply thread, not a mention, not a notification. An echo is closer to
finding that someone left a small stone balanced on a stone you once placed
— you can see it was placed in response, you can see roughly where, but
there is no profile behind it and no feed announcing it happened.

## Core features to describe (and design, not build)

1. **Leave an Echo.** From the existing orb or list view, a visitor can
   select one existing thought and compose a response to it, through the
   same composer already used for an ordinary thought. An echo is still a
   trace of one of the six kinds, still capped at 240 characters, still
   subject to the same validation — it is a *relationship*, not a new kind
   of content.
2. **Persistent connections.** Once left, the parent–child relationship
   between the original thought and the echo survives reloads, new visits,
   and server restarts, exactly as an individual trace does today. A thought
   that has drawn an echo still reads correctly if the echo is later viewed
   on its own.
3. **Visual relationships.** A thought and its echo(es) are connected inside
   the crystal ball by a subtle thread of light — not a line chart, not an
   arrow, not a UI affordance bolted onto the glass, but something that
   reads as part of the same physical material the lights already float in.
   The thread should be faint enough that an unconnected visitor sees only
   the existing weather of lights; it rewards someone who looks.
4. **Cross-time interaction.** A visitor arriving long after an exchange
   started can see that it happened, follow the thread back to what started
   it, and add their own echo to either end. No part of this requires the
   original author to ever return.
5. **Real-time updates.** A visitor currently on the wall watches a new
   echo and its connecting thread appear through the existing SSE channel,
   the same way an unconnected new thought already arrives today — no new
   transport, no polling.
6. **Six forms preserved.** Dream, illusion, bubble, shadow, dew, and
   lightning remain the only kinds, for both original thoughts and echoes.
   An echo does not introduce a seventh kind or a reply-specific kind.
7. **Original experience preserved.** The composer, the six-kind selection,
   the ambient animation and audio, the human orb, and the AI orb all keep
   working exactly as they do today for a visitor who never interacts with
   an echo at all. Nothing about this should be visible or mandatory for a
   visitor who just wants to leave a single passing thought and go.

## What this explicitly is not

- Not a comment section: no usernames, no @-replies, no notification badge,
  no "3 replies" counter rendered as social proof.
- Not a chat: no expectation of presence, no typing indicator, no read
  receipt. The entire point is that the two sides of an echo can be
  separated by an arbitrary amount of time.
- Not a redesign: the six-kind concept, the twin-orb structure, the
  plain-list fallback beneath the orb, and the small/quiet tone of the
  existing README must all still make sense after this ships. If a proposed
  mechanic needs accounts, rankings, or a feed to work, it is the wrong
  mechanic for this wall.
- Not a change to the model orb's contract: AI-generated fragments stay
  ungraspable, unstorable, and never part of an echo chain. Echoes are a
  human-to-human structure; the oracle orb's separation from stored data
  (decision record 0003) is not touched by this proposal.

## Technical direction (for whoever designs the implementation later)

- Reuse the existing Node.js/TypeScript architecture (`node:http`,
  `better-sqlite3`, no framework, no build step) rather than introducing a
  new backend layer. Decision record 0001's reasoning for staying this small
  still applies at this feature's scale.
- Extend SQLite with a backward-compatible parent-child relationship —
  most plausibly a nullable `parent_id` column (or equivalent join table) on
  the existing `traces` table — rather than a new, separate content type.
  Existing rows must remain valid with no parent, and every existing query
  (`recentTraces`, `publicTrace`) must keep working unmodified for data that
  predates this feature.
- Reuse the existing SSE mechanism (`GET /events`, `broadcast()` in
  `src/server.ts`) to push new echoes and their relationships, rather than
  adding a second real-time channel or switching to WebSockets.
- Preserve compatibility with existing data and API behaviour: a trace
  without a parent must still read, render, and broadcast exactly as it does
  today; `GET /traces` consumers that don't know about echoes should not
  break.
- Support mobile, keyboard accessibility, and `prefers-reduced-motion`, in
  line with the project's existing accessibility and responsive posture —
  an echo and its connecting thread need a non-visual equivalent (the
  existing "yours:" visually-hidden-prefix pattern in `src/templates.ts` is
  the precedent to extend, not replace).
- Keep AI-generated content clearly distinguishable from human-authored
  content; nothing about echo threads should make it harder to tell which
  orb, and which words, came from a person.
- Avoid introducing unnecessary dependencies. If the existing stack
  (`better-sqlite3`, vanilla canvas rendering in `orb.js`, SSE) can express
  parent-child relationships and their visualisation, prefer that over a
  graph library, a new real-time protocol, or a client framework.

## Definition of Good

A later implementation of this idea should be judged testable, not just
described. Concrete, checkable criteria an implementer should be able to
satisfy and an evaluator should be able to verify:

**Two visitors interacting at different times**
- Visitor A leaves a thought and closes the tab (or the browser) entirely.
- Visitor B, in a separate session/browser with no shared cookie, arrives
  later, finds A's thought, and leaves an echo on it.
- Without any special timing or server restart, a third party (or A,
  returning independently) can see that the thought now has an echo and can
  read both sides.

**Persistence across reloads and restarts**
- A thought, its echo, and the relationship between them survive a page
  reload.
- They survive a server process restart against the same SQLite file
  (the same restart test PROCESS.md already describes for plain traces).
- A thought with zero echoes and a thought with multiple echoes are both
  represented correctly after restart — no echo count or thread is lost or
  duplicated.

**Real-time synchronisation**
- Two browser tabs open on the wall at once: when one leaves an echo on a
  thought visible in both, the second tab shows the new echo and its
  connecting thread within roughly the same latency the existing SSE
  broadcast already achieves for an ordinary new thought (decision record
  0002's "about a second" bar), without a reload.
- The tab that authored the echo does not see it arrive twice (the existing
  release-token de-duplication pattern in `broadcast()`/`main.js` is the
  precedent).

**Correct relationship visualisation**
- A thread of light connects a thought to each of its echoes and to no
  other light.
- The thread remains identifiable (or its absence is correctly shown) after
  the orb's existing aging/fading-with-time behaviour has been applied to
  one or both ends.
- A thought with no echoes renders exactly as it does today — no empty
  thread stub, no placeholder affordance.

**Accessibility and responsive design**
- The relationship between a thought and its echo(es) is conveyable to a
  screen-reader user through semantic markup or a visually-hidden
  equivalent, not colour or a line alone — mirroring the existing "yours:"
  prefix pattern.
- Composing and discovering an echo is fully operable by keyboard alone
  (tab/enter/arrow-key navigation consistent with the orb's existing
  keyboard support for moving between lights).
- The feature is usable at mobile viewport widths without overflow or
  unreachable controls, and with `prefers-reduced-motion` honoured for any
  new thread/connection animation, exactly as the orb already honours it for
  ambient motion.

**No regression of existing features**
- A visitor who posts an ordinary (non-echo) thought experiences no change
  in behaviour, latency, or validation.
- The six kinds, the 240-character cap, the human/model orb split, the
  oracle's generation loop, and the `/readme/` route all continue to work
  and continue to pass whatever automated checks already cover them.

**Database and API validation**
- A POST that supplies an invalid or non-existent parent is rejected (or
  silently dropped, matching the project's existing "invalid input is
  dropped, not errored into a broken UI" convention) rather than corrupting
  the relationship table.
- `GET /traces` and any new/extended read endpoint return internally
  consistent parent/child references — no echo referencing a parent that
  doesn't exist, no parent reference pointing at a different visitor's
  private data it shouldn't expose.
- Existing rows (traces created before this feature ships) are valid input
  to every new code path without a migration that rewrites or discards them.

**Automated tests and evidence**
- `pnpm check` (typecheck + the existing vitest suite) stays green, extended
  with tests for: creating an echo, persistence of the relationship across
  a simulated restart, rejection of a malformed parent reference, and SSE
  delivery of an echo event — following the existing pattern in
  `spec/trace.test.ts`, `spec/live.test.ts`, and `spec/invariants.test.ts`.
- Manual verification evidence (screenshots or a recorded walkthrough) shows
  the cross-time scenario above actually performed with two distinct
  browser sessions, not just asserted.

## Phased implementation strategy (described, not executed)

This phasing is here so a future implementation run has a sequence to
follow — it is guidance for later work, not a plan to carry out now.

1. **Data model.** Add a nullable parent reference to the `traces` table,
   with a migration-free, backward-compatible default (`NULL` for every
   existing row). Extend `src/db.ts` with a query for "echoes of trace X"
   and confirm existing queries are unaffected.
2. **Composing an echo.** Extend the existing composer and `POST /trace`
   handler to accept an optional parent id, with the same validation
   (kind, length, non-empty text) applied to an echo as to a plain thought.
   No visual thread yet — just correct, persisted data.
3. **Reading the relationship.** Extend `GET /traces` (or add a narrowly
   scoped endpoint) to expose parent/child references, and extend
   `publicTrace()` accordingly, keeping the existing shape backward
   compatible for a reader that ignores the new field.
4. **Visual thread in the orb.** Render the connecting thread of light in
   `public/js/orb.js` between a mote and its parent/children, as a new,
   narrowly scoped drawing pass that does not alter existing mote placement,
   motion, or the featured-thought cycling already in place.
5. **Discovery interaction.** Add the "leave an echo" entry point (selecting
   an existing thought, then composing a response to it) and the "this
   thought has an echo" discovery affordance for a visitor encountering a
   thread for the first time, including its screen-reader-visible
   equivalent.
6. **Real-time wiring.** Extend `broadcast()` and the `/events` stream to
   carry the new relationship alongside a new echo, and extend the client's
   `arrive()`/event handling in `public/js/main.js` to draw the thread live
   rather than only on next reload.
7. **Verification pass.** Run the full Definition of Good checklist above:
   restart persistence, two-tab real-time sync, accessibility pass,
   responsive pass, and the extended automated test suite.

## Constraints this proposal respects

- Does not implement any of the above; `prompt.md` is the only artefact
  this task produces.
- Does not touch application source code, the database file, migrations, or
  `fly.toml`/production configuration.
- Does not deploy to Fly.io.
- Does not change the six-kind concept, the model orb's contract, or the
  project's existing small/quiet design stance — it extends the wall's
  *relationships*, not its scope or tone.

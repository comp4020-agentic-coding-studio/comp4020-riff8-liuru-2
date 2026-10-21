# Process overview

This crit ran across eighteen stateless Claude Code invocations over its
week, each starting from `memory/` (this agent's own notes, outside the
repo) and the crit's JSON brief. The first run built and deployed the
slice; every run after it either found and fixed a real defect or recorded
a clean pass. Commit links below go to
[the repo's history](https://github.com/comp4020-agentic-coding-studio/comp4020-final-liuru/commits/main).

## From brief to concept

The crit's bar is narrow on purpose: deployed, doing its core thing for a
stranger, with a trace that survives a return visit. Real-time, features and
polish come later. The final-project brief is the wider contract this slice
grows into, and its notes on "good" gesture at the small web, home-cooked
software and games for a handful of friends. I searched for each before
writing README's argument around them, rather than paraphrasing the brief
back at itself.

The concept --- a shared wall where a visitor tags a short thought as one of
the Diamond Sūtra's six similes (dream, illusion, bubble, shadow, dew,
lightning) --- comes from this agent's own name in the course (Tang Yin's
Buddhist name, 六如). The theme is a constraint, not a skin: a wall whose
premise is "everything here is already passing" can't have accounts,
streaks, or a popularity sort without contradicting itself. That is the
design decision behind
[`ff0b374`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-liuru/commit/ff0b374)'s
README, and the repo's `CLAUDE.md` turns it into rules future runs follow.

## Building the slice

[`bf52500`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-liuru/commit/bf52500)
replaced the placeholder with plain `node:http` and `better-sqlite3`, one
table, no framework and no build step. The reasoning is written up as
[decision record 0001](docs/decisions/0001-plain-node-and-sqlite.md)
([`572456a`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-liuru/commit/572456a)),
the format the brief suggests: three routes don't need routing middleware,
and the 256 MB Fly machine with one volume rules out a separate database
server. The record also names where it expects to break --- crit 9's
real-time layer --- and what would trigger a record 0002.

Persistence is the one thing this week grades, so I tested it by restart
rather than by reading the SQL: posted through a real cookie jar, killed the
server, started a fresh process on the same data directory, and found the
trace still there.
[`073f417`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-liuru/commit/073f417)
turned that promise and the server's validation into HTTP-level tests
against the running app. Before the first deploy I built the real Dockerfile
locally and ran `pnpm check` against the container with `--tmpfs /data`,
the way CI does, since a dev-server pass says nothing about a missed native
build step in the image.

## What the later runs found

The deliberate habit across the week was a fresh read each run, aimed at a
different category, rather than repeating the last run's routine. Most of
what turned up was invisible to `pnpm check`, which was green throughout.

- **Dark mode.** The page declares `color-scheme: light dark`, but muted
  text kept fixed grey literals. Emulating dark mode and pixel-sampling a
  screenshot measured 3.3--4.2:1, below AA;
  [`c628797`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-liuru/commit/c628797)
  switched to `light-dark()` so each scheme clears AA on its own.
- **Heading outline.** `/readme/` wrapped README's own `h1` in a second page
  `h1`; reading the real heading sequence caught it
  ([`d54402b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-liuru/commit/d54402b)).
- **The 240-character cap.** `CLAUDE.md` listed it as enforced, but no test
  covered it.
  [`51e7a8f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-liuru/commit/51e7a8f)
  added one, and the 300-character unbroken string it left on the wall then
  blew the grid column out to 2213 px on a phone. A grid item's default
  `min-width: auto` beats `overflow-wrap`;
  [`051ec4d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-liuru/commit/051ec4d)
  fixed that and added the missing `main` landmark. Writing the test first
  is what produced the input that broke the layout.
- **Visual-only meaning.** The "mine" highlight that lets a returning
  visitor find their own trace was a background colour and nothing else, so
  a screen-reader user never got the feature README describes.
  [`b953074`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-liuru/commit/b953074)
  added a visually hidden "yours:" prefix;
  [`2dd79d3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-liuru/commit/2dd79d3)
  did the same for each kind's glyph, which had leaned on a `title`
  tooltip. axe-core passed both before the fix: it checks markup against
  rules, not whether every visual distinction has a non-visual twin.
- **Concurrency and the brief.** One run fired dozens of simultaneous
  POSTs at a throwaway server and counted the result (exact) rather than
  trust the driver's docs. Walking the brief item by item later found a
  missing decision record (now 0001) and a dead *Pico Park* citation
  ([`61c58f8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-liuru/commit/61c58f8)).

Each fix was deployed and checked against the live URL, not the local build.

## The harness behind it

The workflow is mostly memory, not prompts. Each lesson above went into
`memory/MEMORY.md` as a rule the next run loads (probe a free port, emulate
dark mode before trusting contrast, ask what each CSS-only state means to a
screen reader), and `memory/now.md` carried one next action between runs,
including "record still clean and stop" rather than invent work.

## This riff: replies, and a wall that catches up

A pod's `prompt.md` asked, in priority order, for reliable posting and
reconnects, anonymous replies, a model that downloads only when asked, and
easier reading. In one unattended run, I built the server layer first.

The insight that shaped it was that reliability and replies share one
mechanism. Ids only ever grow, so the pair `<trace>.<reply>` is a cursor:
the page is rendered with the one it was read at, every event carries the
one after it, and `/events?since=` replays the gap. A client request id under
a unique index makes a retry return the first stored row rather than a second
one ([7f4b63b](https://github.com/comp4020-agentic-coding-studio/comp4020-riff8-liuru-2/commit/7f4b63b)). The client keeps one reply store behind two
views of each thread, so a reply arriving from elsewhere updates the panel
and the list without touching an open draft ([937b530](https://github.com/comp4020-agentic-coding-studio/comp4020-riff8-liuru-2/commit/937b530)).
[89b2924](https://github.com/comp4020-agentic-coding-studio/comp4020-riff8-liuru-2/commit/89b2924) made the model wait for an explicit wake, and
[bed3f7a](https://github.com/comp4020-agentic-coding-studio/comp4020-riff8-liuru-2/commit/bed3f7a) brought README, `CLAUDE.md` and decision record 0004
into line with what the wall now is.

Verification ran in two separate browser sessions, plus a server killed
mid-session to prove a disconnected page catches up, and a monkeypatched
`fetch` to lose a POST's answer and confirm the retry reused its id. Then an
independent reviewer read the diff. It found a real bug: a failed
snapshot during a `reset` moved the cursor forward and reported "nothing was
missed". It also found four edge cases, all fixed in [8f811ff](https://github.com/comp4020-agentic-coding-studio/comp4020-riff8-liuru-2/commit/8f811ff).
One mistake of my own: I committed once before reading a test result, and a
race in my own spec turned it red. I folded the fix into that commit before
going on, and `spec/README.md` now warns that spec files run in parallel
against one app.

## What's next

Rate limiting and moderation stay named in README as real, open gaps, and
replies make them more pressing: a reply is aimed at one person's words.

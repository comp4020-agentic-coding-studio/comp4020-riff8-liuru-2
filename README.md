# 六如 — a wall for passing things

This is a shared wall. Anyone who visits can leave a short, passing thought,
tagged as one of the six similes from the closing lines of the Diamond Sūtra:
a dream, an illusion, a bubble, a shadow, dew, a flash of lightning. Those
six are where my name in this course comes from (Tang Yin's Buddhist name,
六如, "the six as-ifs"), so the theme is the design constraint, not
decoration: everything here is supposed to feel like it's already passing.

## What good means here

Good, for this app, is small and quiet rather than sticky. Robin Sloan's
[*An App Can Be a Home-Cooked Meal*](https://www.robinsloan.com/notes/home-cooked-app/)
argues that software for a small circle can just be finished, with nothing
chasing you back. The wall has no accounts, no
follower counts, no read receipts.

The [Small Technology Foundation](https://small-tech.org/)'s case for a
small web, public spaces people can understand the whole of, is why nothing
is curated or ranked. Thoughts hang in a crystal ball, each light moving the
way its as-if moves; older lights grow fainter, the glass's only ordering. The same thoughts sit in a plain newest-first list beneath it,
and choosing one there turns its light to the front of the glass.

A thought can be answered. Replies are anonymous, one level deep, oldest
first, and quiet: a count and a fold under the thought, never a like, a
name or a notification. A reply is a second voice in the room, not a thread
that pulls you back.

And the brief's own point, that something should be *better* because other
people are using it now, the way [*Pico Park*](https://store.steampowered.com/app/1509960/PICO_PARK/)
only works with everyone present, is why the wall is live. Someone else's
thought falls into your glass while you watch, and their reply appears
under the thought you are reading without disturbing what you're writing.
A page that loses its connection says so, then catches up on exactly what
it missed.

## The second glass

Beside the human orb a second one holds what a small language model
imagines from what people left. It runs
[LFM2.5-230M](https://huggingface.co/LiquidAI/LFM2.5-230M) in your browser,
and only once you ask: waking it names the download, and you can cancel or
stop it. It reads a few stored thoughts at a time, never replies, and keeps
its short memory in your browser. Its thoughts are labelled as
generated everywhere and never stored on the wall.
[Decision record 0003](docs/decisions/0003-the-model-runs-in-the-visitors-browser.md)
has the measurements.

## What's enforced vs. what's judged

Enforced, in `spec/`: a trace needs one of the six kinds and non-empty text
capped at 240 characters. A reply needs a thought that exists and 1--240
characters, or it is refused with a reason. Both persist in SQLite on the
app's volume. A retried post is stored once; a page reconnecting from any
point gets everything after it, or is told to reload its view
([decision record 0004](docs/decisions/0004-replies-and-catching-up.md)
says where that limit sits). The model's memory stays bounded and never
holds human words or replies.

Judged, by me and by a reader: whether the wall feels like the six similes,
not a message board with a select box, and whether replies stay quiet in
real use.

## What I deliberately didn't build yet

No moderation, rate limiting or way to remove a trace or reply, and no
distinction between visitors beyond "yours" and everyone else's. For a wall
this small I haven't yet needed them, which isn't the same as never
needing them. Sound, type and licences are in
[docs/credits.md](docs/credits.md).

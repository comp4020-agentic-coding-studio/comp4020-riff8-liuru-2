# 0004: replies, and a page that catches up on what it missed

Status: accepted (crit 10 riff). Extends 0002's stream.

## Context

The pod's brief for this riff asked for two things that turn out to share a
mechanism. Visitors should be able to answer someone else's thought with a
short anonymous reply, and posting and live updates should be reliable: a
retried post must not be stored twice, and a page that loses its connection
must get back what it missed. Before this, `EventSource` reconnected on its
own but nothing was replayed, and the `release` token the client sent was
echoed on the stream but never used to deduplicate anything.

## Decision

- **Replies** live in their own `replies` table with a foreign key to the
  trace they answer, created by a boot-time migration that never rewrites an
  existing row. They are one level deep, oldest first, anonymous ("anonymous"
  to everyone else, "you" to whoever left one, by the same cookie that marks
  a trace as yours). The server refuses a blank reply or one over 240
  characters with a 400 and a reason, and a reply to a missing thought with a
  404. Unlike the plain trace form, an over-long reply is refused rather than
  cut short, because the reply composer always runs with a script and can
  explain itself. Replies are never shown to the model.
- **Idempotent posts.** Every trace and reply may carry a client-generated
  request id, under a unique index. Posting the same id again returns what
  was stored the first time (200 rather than 201). The client reuses the id
  only when retrying the *same* words, so an intentional repeat is a new
  thought. The index is across the table, not per visitor, so a retry still
  matches when the lost answer also carried the visitor's first cookie.
- **A cursor.** Trace ids and reply ids only grow, so the pair
  `<trace>.<reply>` says exactly what a page has seen. The page is rendered
  with the cursor it was read at, and every SSE event's id is the cursor
  just after it. `/events?since=` (or the browser's `Last-Event-ID`) replays
  everything after it, traces before replies, then sends `synced`.
- **Reconnecting by hand.** The page closes a broken stream and reopens it
  from its latest cursor with a gentle back-off, instead of leaving it to
  `EventSource`'s own retry, which can't change the URL. A small line at the
  top of the screen says when the wall is out of touch and, once, when it
  has caught up and how much it missed.
- **The limit, honestly.** A page that missed more than 500 traces or 500
  replies is sent `reset` instead, and fetches `/snapshot`: the newest 200
  traces and their replies, the same view a fresh load gets. Anything older
  than those 200 is not on anyone's page, so nothing a reader could have
  seen is lost.

## Alternatives weighed

- **Re-fetch the whole wall on every reconnect.** Simple and always right,
  but it rebuilds the list under a reader's focus and draft, and costs a full
  snapshot for every flaky phone.
- **Dedupe by text.** Would block someone saying the same thing twice on
  purpose, which the brief explicitly allows.
- **Nested replies, likes, notifications.** Out of scope by the brief and by
  README: each one makes the wall something you come back to for attention.

## Cost

Replayed events are held to 500 of each kind, so a page asleep through a
very busy day reloads its view instead of replaying it. Request ids are
stored forever beside their rows (a few dozen bytes each). Replies add a
second kind of event to every open page.

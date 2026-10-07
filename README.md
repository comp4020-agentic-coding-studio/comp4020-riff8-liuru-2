# 六如 — a wall for passing things

This is a shared wall. Anyone who visits can leave a short, passing
thought — tagged as one of the six similes from the closing lines of the
Diamond Sūtra: a dream, an illusion, a bubble, a shadow, dew, a flash of
lightning. Those six are also where my own name in this course comes from
(Tang Yin's Buddhist name, 六如, "the six as-ifs"), so the theme isn't
decoration bolted onto a generic guestbook — it's the actual design
constraint: everything on the wall is supposed to feel like it's already
passing.

## What good means here

Good, for this app, is small and quiet rather than sticky. The brief points at
the small web, home-cooked software, and games built for a handful of people
rather than a market, and those are the three things I actually leaned on
while deciding what to build and what to leave out.

Robin Sloan's [*An App Can Be a Home-Cooked Meal*](https://www.robinsloan.com/notes/home-cooked-app/)
argues that software made for a specific, small circle of people — not a
public, not a userbase — can afford to just be finished: no growth loop, no
notifications chasing you back. The wall has no accounts, no follower count,
no read receipts. You can find your own trace again, but there's nothing here
trying to make you come back.

The [Small Technology Foundation](https://small-tech.org/)'s case for a small
web — public spaces people can actually understand the whole of, without
tracking or an algorithmic feed — is why nothing on the wall is curated or
ranked. The thoughts hang in a crystal ball, each one a light that moves the
way its own as-if moves (dreams drift, shadows trail smoke, lightning
crackles when a hand comes near), and you turn the glass to find them. No
light is brighter for being popular, and underneath the orb the same
thoughts sit in one plain newest-first list, for anyone who'd rather read
than scry. What you see is what's actually there.

And the design point the final-project brief itself makes explicitly — build
something that's *better* because other people are using it right now, the
way small local-multiplayer games (like [*Pico Park*](https://store.steampowered.com/app/1509960/PICO_PARK/))
only work because everyone is present at once — is why the orb is live. When
someone else lets a thought go, it falls into your glass while you watch,
without a reload. That's the whole of the co-presence: no names, no
"someone is typing", just the sense that the ball is filling.

## What's enforced vs. what's judged

Enforced, in `spec/`: a trace needs a real kind (one of the six) and non-empty
text capped at 240 characters, or the server silently drops it rather than
storing garbage. Traces persist in SQLite on the app's own volume, so they
survive a restart or a redeploy — not just the current process.

Judged, by me now and by a reader later: whether the wall actually feels like
the six similes it's named after, not a message board with a select box on
it, and whether the orb stays legible once real people have filled it.
I haven't built moderation, rate limiting, or a way to remove a trace — for a
wall this small, the honest position is that I haven't yet had a reason to
need any of them, not that I've reasoned my way out of needing them forever.

## What I deliberately didn't build yet

No visible distinction between visitors beyond "yours vs. everyone else's"
(no names, colours, or avatars), no server-side logging beyond what Fly
captures by default (crit 11), and no moderation. All three are real gaps,
not oversights.

## Sound, type and licences

Every sound except the Bubble music is synthesised in the browser with the
Web Audio API (`public/js/audio.js`): six small palettes, one per as-if, so
there is no third-party audio to license. Sound starts only after you touch
the page, and the control in the corner mutes it for the session. The Bubble
music, `assets/bubble_background_music.mp3`, was supplied with this riff's
brief by the pod that wrote it. The hanzi are set in
[Ma Shan Zheng](https://fonts.google.com/specimen/Ma+Shan+Zheng) and the text
in [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond),
both under the SIL Open Font License; the subsets and their licence texts
are in `public/fonts/`.

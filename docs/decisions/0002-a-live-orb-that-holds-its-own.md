# 0002: a live orb, and your own thought lands before anyone else's

Status: accepted (crit 9 riff). Follows 0001's plan for real-time.

## Context

The wall became a crystal ball: every stored thought is a light in the
glass, and letting one go plays a release animation that carries it down
into the orb. The crit-9 brief asks for one person's change to reach
everyone else within about a second, without a reload. That raises a
multi-user question the plain list never had: what happens when someone
else's thought arrives while yours is still mid-flight?

## Decision

- `GET /events` is a Server-Sent Events stream from the same `node:http`
  server, as 0001 planned. Every stored trace is broadcast to every open
  page, without its visitor id. A heartbeat comment every 25 seconds keeps
  idle proxies from closing the connection; `EventSource` reconnects on its
  own.
- Other people's thoughts fall into the glass from above, with the
  orb pulsing as each arrives. A screen reader hears "someone else just let
  go of a shadow: …".
- While your own thought is being released, arrivals from the stream are
  held back, then let in once yours has landed. Your thought is always the
  one the orb turns to and reads out. Its own broadcast is recognised by id
  and dropped, so it never shows up twice or gets announced as someone
  else's.

## Alternatives weighed

- **Reload-only (the crit-8 state).** Simplest, and honest about the wall
  being quiet. But it means two people in the same room never see each
  other's thoughts arrive, which is the whole point of a shared glass.
- **Polling `/traces` every second.** No long-lived connections. But it
  costs a full list per visitor per second on a 256 MB machine, and arrivals
  come in clumps rather than one at a time.
- **Letting arrivals interleave with your own release.** Truer to the
  moment, but your thought could land second, with the orb already turned
  toward a stranger's, and the "yours" reading could go to the wrong light.

## Cost

Held arrivals can be up to about three seconds late for the person who is
releasing. Each open page holds one connection, which is fine for a
classroom and would need a cap long before it needed a broker. Nothing
announces who else is looking, and the presence is only ever felt as
arrivals.

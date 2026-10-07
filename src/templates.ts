import { KINDS, type Kind, type Trace } from "./db.ts";

const KIND_META: Record<
  Kind,
  { glyph: string; hanzi: string; name: string; label: string; meaning: string }
> = {
  dream: {
    glyph: "☁",
    hanzi: "夢",
    name: "Dream",
    label: "a dream",
    meaning: "something that felt real, then faded",
  },
  illusion: {
    glyph: "◈",
    hanzi: "幻",
    name: "Illusion",
    label: "an illusion",
    meaning: "something that wasn’t what it seemed",
  },
  bubble: {
    glyph: "○",
    hanzi: "泡",
    name: "Bubble",
    label: "a bubble",
    meaning: "something fragile and brief",
  },
  shadow: {
    glyph: "◐",
    hanzi: "影",
    name: "Shadow",
    label: "a shadow",
    meaning: "something that followed or lingered",
  },
  dew: {
    glyph: "•",
    hanzi: "露",
    name: "Dew",
    label: "dew",
    meaning: "something small and temporary",
  },
  lightning: {
    glyph: "⚡",
    hanzi: "電",
    name: "Lightning",
    label: "a flash of lightning",
    meaning: "something sudden and intense",
  },
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function relativeTime(ms: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** What a browser is told about a trace: never whose it is, only whether it's yours. */
export function publicTrace(t: Trace, visitorId: string) {
  return { id: t.id, kind: t.kind, text: t.text, createdAt: t.createdAt, mine: t.visitorId === visitorId };
}

const shell = (title: string, bodyClass: string, body: string): string => `<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="theme-color" content="#07060c" />
    <title>${escapeHtml(title)}</title>
    <link rel="preload" href="/static/fonts/mashanzheng-subset.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/static/fonts/cormorant.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="icon" href="/static/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/static/wall.css" />
  </head>
  <body class="${bodyClass}">
    ${body}
  </body>
</html>`;

function traceItem(t: Trace, visitorId: string): string {
  const meta = KIND_META[t.kind];
  const isMine = t.visitorId === visitorId;
  const mineLabel = isMine ? `<span class="visually-hidden">yours: </span>` : "";
  return `<li class="trace kind-${t.kind}${isMine ? " mine" : ""}" data-id="${t.id}" data-kind="${t.kind}" data-created="${t.createdAt}"${isMine ? " data-mine" : ""}>
            <span class="glyph" aria-hidden="true" title="${meta.hanzi} ${escapeHtml(meta.label)}">${meta.hanzi}</span>
            <span class="visually-hidden">tagged as ${escapeHtml(meta.label)}: </span>
            <span class="text">${mineLabel}${escapeHtml(t.text)}</span>
            <time class="when" datetime="${new Date(t.createdAt).toISOString()}">${relativeTime(t.createdAt)}</time>
          </li>`;
}

function card(kind: Kind): string {
  const m = KIND_META[kind];
  return `<label class="card" data-kind="${kind}">
            <input type="radio" name="kind" value="${kind}" required />
            <canvas class="card-canvas" aria-hidden="true"></canvas>
            <span class="card-hanzi" lang="zh-Hant" aria-hidden="true" data-hanzi="${m.hanzi}">${m.hanzi}</span>
            <span class="card-words">
              <span class="card-name"><span class="card-glyph" aria-hidden="true">${m.glyph}</span> ${m.name}</span>
              <span class="card-meaning">${escapeHtml(m.meaning)}</span>
            </span>
            <span class="card-chosen"><span class="seal" lang="zh-Hant" aria-hidden="true">${m.hanzi}</span>chosen</span>
          </label>`;
}

export function renderWall(traces: Trace[], visitorId: string): string {
  const items = traces.length
    ? traces.map((t) => traceItem(t, visitorId)).join("\n")
    : `<li class="empty">nothing has passed through yet</li>`;
  const count = traces.length;

  const body = `
    <a class="skip" href="#scry">skip to the crystal ball</a>
    <canvas class="ambient" aria-hidden="true"></canvas>
    <div class="world">
      <header class="masthead">
        <h1>
          <span class="mark" lang="zh-Hant">六如</span>
          <span class="title">a wall for passing things</span>
        </h1>
        <nav class="meta" aria-label="about and sound">
          <a href="/readme/">what this is for</a>
          <button type="button" class="sound-toggle" aria-pressed="true" hidden>
            <span class="sound-icon" aria-hidden="true"></span><span class="sound-label">sound on</span>
          </button>
        </nav>
      </header>

      <main>
        <section class="compose" aria-labelledby="compose-h">
          <form class="release-form" method="post" action="/trace">
            <div class="composer">
              <h2 id="compose-h" class="ask"><label for="thought">What passed through your mind?</label></h2>
              <p class="whisper" id="thought-hint">A thought, a feeling, a fragment &mdash; not an essay.</p>
              <div class="pool">
                <textarea id="thought" name="text" maxlength="240" required rows="4" spellcheck="true"
                  aria-describedby="thought-hint thought-count" placeholder="it was only for a moment, but&hellip;"></textarea>
                <div class="count" id="thought-count">
                  <svg class="count-ring" viewBox="0 0 36 36" aria-hidden="true">
                    <circle class="count-track" cx="18" cy="18" r="15" />
                    <circle class="count-arc" cx="18" cy="18" r="15" pathLength="240" />
                  </svg>
                  <span><span class="count-n">0</span> of 240 characters</span>
                </div>
              </div>
            </div>

            <fieldset class="forms">
              <legend><span class="forms-h">Give it a form</span> <span class="whisper">one of the six as-ifs &mdash; <span class="for-hover">hover them, they answer</span><span class="for-touch">touch them, they answer</span></span></legend>
              <div class="cards">
          ${KINDS.map(card).join("\n          ")}
              </div>
            </fieldset>

            <div class="release">
              <button type="submit" class="let-go"><span class="let-go-text">let it go</span></button>
              <p class="status" role="status"></p>
            </div>
          </form>
        </section>

        <div class="thread" aria-hidden="true"><span class="thread-line"></span></div>

        <section class="scry" id="scry" aria-labelledby="scry-h" data-count="${count}">
          <h2 id="scry-h" class="ask">Everything that has passed through</h2>
          <p class="whisper scry-hint">
            <span class="scry-count">${count === 1 ? "one thought" : `${count} thoughts`}</span>, held for a while.
            <span class="js-only">Drag the glass to turn it; touch a light to read it.</span>
          </p>
          <div class="orb-stage" hidden>
            <div class="orb" tabindex="0" role="group" aria-roledescription="crystal ball"
              aria-label="crystal ball of everyone's thoughts" aria-describedby="orb-help">
              <canvas class="orb-canvas" aria-hidden="true"></canvas>
            </div>
            <div class="pedestal" aria-hidden="true">
              <svg viewBox="0 0 400 130">
                <defs>
                  <linearGradient id="lacquer" x1="0" x2="1">
                    <stop offset="0" stop-color="#0b0810" />
                    <stop offset="0.35" stop-color="#2b1f31" />
                    <stop offset="0.5" stop-color="#47344a" />
                    <stop offset="0.65" stop-color="#2b1f31" />
                    <stop offset="1" stop-color="#0b0810" />
                  </linearGradient>
                  <radialGradient id="catch" cx="0.5" cy="0.5" r="0.5">
                    <stop offset="0" stop-color="currentColor" stop-opacity="0.75" />
                    <stop offset="1" stop-color="currentColor" stop-opacity="0" />
                  </radialGradient>
                </defs>
                <path d="M78 22 C 120 34, 280 34, 322 22 C 312 48, 276 60, 258 70 C 300 80, 352 92, 372 108 C 340 124, 60 124, 28 108 C 48 92, 100 80, 142 70 C 124 60, 88 48, 78 22 Z" fill="url(#lacquer)" />
                <path d="M78 22 C 120 34, 280 34, 322 22" fill="none" stroke="currentColor" stroke-opacity="0.55" stroke-width="1.5" />
                <path d="M28 108 C 60 124, 340 124, 372 108" fill="none" stroke="currentColor" stroke-opacity="0.25" stroke-width="1" />
                <ellipse class="catch" cx="200" cy="30" rx="110" ry="14" fill="url(#catch)" />
              </svg>
            </div>
            <div class="reveal"></div>
            <p class="visually-hidden orb-live" aria-live="polite" aria-atomic="true"></p>
            <p id="orb-help" class="visually-hidden">Left and right arrow keys move between thoughts; each one is read out as it comes to the front. Escape lets go of it.</p>
          </div>
          <div class="kinds-legend js-only" role="group" aria-label="show one kind of thought at a time">
            ${KINDS.map(
              (k) =>
                `<button type="button" class="legend-kind" data-kind="${k}" aria-pressed="false"><span class="legend-hanzi" lang="zh-Hant" aria-hidden="true">${KIND_META[k].hanzi}</span>${KIND_META[k].name}</button>`,
            ).join("\n            ")}
          </div>
          <p class="again-wrap js-only"><button type="button" class="again">leave another thought</button></p>
          <details class="ledger" open>
            <summary>every thought, as plain text</summary>
            <ol class="wall">
          ${items}
            </ol>
          </details>
        </section>
      </main>

      <footer class="sutra">
        <p class="verse" lang="zh-Hant" aria-hidden="true">
          <span>一切有為法</span><span>如夢幻泡影</span><span>如露亦如電</span><span>應作如是觀</span>
        </p>
        <p class="gloss">All conditioned things are as a dream, an illusion, a bubble, a shadow, as dew, as a flash of lightning; thus should they be contemplated. <cite>&mdash; closing verse of the Diamond Sūtra</cite></p>
        <p class="colophon"><a href="/readme/">what this is for</a></p>
      </footer>
    </div>
    <script type="module" src="/static/js/main.js"></script>
  `;
  return shell("六如 — a wall for passing things", "wall-page", body);
}

export function renderReadme(bodyHtml: string): string {
  const body = `
    <canvas class="ambient" aria-hidden="true"></canvas>
    <div class="world readme">
      <nav class="meta"><a href="/">back to the wall</a></nav>
      <main class="prose">${bodyHtml}</main>
    </div>
    <script type="module" src="/static/js/ambient-only.js"></script>
  `;
  return shell("About — 六如", "readme-page", body);
}

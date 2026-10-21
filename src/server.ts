import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { createReadStream, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, extname, normalize, resolve, sep } from "node:path";
import { marked } from "marked";
import {
  MAX_TEXT,
  addReply,
  addTrace,
  currentCursor,
  formatCursor,
  isKind,
  missedSince,
  parseCursor,
  recentTraces,
  repliesFor,
  type Reply,
  type Trace,
} from "./db.ts";
import { publicReply, publicTrace, renderReadme, renderWall } from "./templates.ts";

const PORT = Number(process.env.PORT ?? 8080);
const VISITOR_COOKIE = "visitor";
const FIVE_YEARS = 60 * 60 * 24 * 365 * 5;
// A trace is at most 240 characters; anything far past that is not a trace.
const MAX_BODY = 16 * 1024;
// A page that missed more than this many traces or replies (while asleep, say)
// is told to fetch a fresh snapshot instead of hearing them one by one.
const REPLAY_LIMIT = 500;

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

// The model orb's runtime runs in the visitor's browser, so its files are
// served from the installed packages rather than copied into public/.
const require = createRequire(import.meta.url);
const transformersDist = dirname(require.resolve("@huggingface/transformers"));
const ortDist = dirname(createRequire(transformersDist).resolve("onnxruntime-web"));

// Cross-origin isolation lets the model run on several threads. `credentialless`
// rather than `require-corp`, so the weights can still come from Hugging Face.
const ISOLATION = {
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-embedder-policy": "credentialless",
};

// URL prefix -> directory it may read from. Nothing outside these is served.
const STATIC_ROOTS: Record<string, string> = {
  "/static/": resolve("public"),
  "/assets/": resolve("assets"),
  "/vendor/transformers/": transformersDist,
  "/vendor/ort/": ortDist,
};

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    try {
      out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      // a malformed cookie (perhaps another app's on the same host) is skipped, not fatal
    }
  }
  return out;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function visitorCookie(id: string): string {
  // Persistent identity, not a login: this is what lets a returning stranger
  // find their own trace again without an account.
  return `${VISITOR_COOKIE}=${id}; Max-Age=${FIVE_YEARS}; Path=/; HttpOnly; SameSite=Lax`;
}

function wantsJson(req: IncomingMessage): boolean {
  return (req.headers.accept ?? "").includes("application/json");
}

async function serveStatic(
  pathname: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  for (const [prefix, root] of Object.entries(STATIC_ROOTS)) {
    if (!pathname.startsWith(prefix)) continue;
    const file = resolve(root, normalize(decodeURIComponent(pathname.slice(prefix.length))));
    const type = MIME[extname(file)];
    if (!file.startsWith(root + sep) || !type) return false;
    try {
      // revalidate every time: a redeploy should reach open browsers at once
      const info = await stat(file);
      if (!info.isFile()) return false;
      const etag = `"${info.size.toString(36)}-${info.mtimeMs.toString(36)}"`;
      const headers = { etag, "cache-control": "no-cache", ...ISOLATION };
      if (req.headers["if-none-match"] === etag) {
        res.writeHead(304, headers);
        res.end();
        return true;
      }
      // streamed, not buffered: the inference runtime is tens of megabytes
      res.writeHead(200, { ...headers, "content-type": type, "content-length": info.size });
      createReadStream(file)
        .on("error", () => res.destroy())
        .pipe(res);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// Everyone with the page open holds one of these; a new trace or reply goes to
// all of them, so the orb fills while you watch rather than on your next reload.
const listeners = new Set<ServerResponse>();

/**
 * A client's own random id for one submission. Posting again with the same id
 * (a retry after a lost answer) gets back what was stored the first time.
 */
function requestId(params: URLSearchParams): string | null {
  const id = params.get("request") ?? params.get("release") ?? "";
  return /^[A-Za-z0-9-]{8,64}$/.test(id) ? id : null;
}

// Each event's SSE id is the cursor just after it, so a reconnecting
// EventSource sends back (as Last-Event-ID) exactly where it got up to.
function sse(event: string, data: unknown, id?: string): string {
  return `${id ? `id: ${id}\n` : ""}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// The request id rides along so the posting page can recognise its own
// submission on the stream (live or replayed) even if the POST's answer never
// reaches it. It is a random id that only says "this is that submission".
const traceEvent = (t: Trace) => ({ ...publicTrace(t, ""), request: t.requestId ?? null });
const replyEvent = (r: Reply) => ({ ...publicReply(r, ""), request: r.requestId ?? null });

function broadcast(event: string, data: unknown): void {
  const message = sse(event, data, formatCursor(currentCursor()));
  for (const res of listeners) res.write(message);
}

/** The wall as a page first sees it: the newest traces, their replies, and the cursor they were read at. */
function snapshot(visitorId: string) {
  const cursor = formatCursor(currentCursor());
  const traces = recentTraces();
  return {
    cursor,
    traces: traces.map((t) => publicTrace(t, visitorId)),
    replies: repliesFor(traces).map((r) => publicReply(r, visitorId)),
  };
}

setInterval(() => {
  for (const res of listeners) res.write(": still here\n\n");
}, 20_000).unref();

function json(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const cookies = parseCookies(req.headers.cookie);
    const existingVisitor = cookies[VISITOR_COOKIE];
    const visitorId = existingVisitor ?? randomUUID();
    const setCookie = existingVisitor ? undefined : visitorCookie(visitorId);
    const cookieHeader: Record<string, string> = setCookie ? { "set-cookie": setCookie } : {};

    if (url.pathname === "/" && req.method === "GET") {
      const traces = recentTraces();
      const html = renderWall(traces, repliesFor(traces), formatCursor(currentCursor()), visitorId);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", ...ISOLATION, ...cookieHeader });
      res.end(html);
      return;
    }

    if (url.pathname === "/trace" && req.method === "POST") {
      const raw = await readBody(req);
      const params = new URLSearchParams(raw);
      const kind = params.get("kind") ?? "";
      const text = (params.get("text") ?? "").trim().slice(0, MAX_TEXT);
      const request = requestId(params);
      const stored = isKind(kind) && text.length > 0 ? addTrace(visitorId, kind, text, request) : undefined;
      if (stored?.created) broadcast("trace", traceEvent(stored.trace));

      if (wantsJson(req)) {
        json(
          res,
          stored ? (stored.created ? 201 : 200) : 400,
          stored
            ? { ...publicTrace(stored.trace, visitorId), request }
            : { error: "a trace needs one of the six kinds and some text" },
          cookieHeader,
        );
        return;
      }

      // The plain form path: a bad submission is silently dropped, and either
      // way the visitor lands back on the wall.
      res.writeHead(303, { location: "/", ...cookieHeader });
      res.end();
      return;
    }

    if (url.pathname === "/reply" && req.method === "POST") {
      const params = new URLSearchParams(await readBody(req));
      const traceId = Number(params.get("trace"));
      const text = (params.get("text") ?? "").trim();
      const request = requestId(params);
      let error = "";
      let status = 400;
      let stored: ReturnType<typeof addReply>;
      if (!Number.isSafeInteger(traceId) || traceId <= 0) error = "a reply has to answer a thought on the wall";
      else if (!text) error = "a reply needs some words";
      else if (text.length > MAX_TEXT) error = `a reply is at most ${MAX_TEXT} characters`;
      else {
        stored = addReply(traceId, visitorId, text, request);
        if (!stored) {
          status = 404;
          error = "that thought is no longer on the wall";
        }
      }
      if (stored?.created) broadcast("reply", replyEvent(stored.reply));

      if (wantsJson(req)) {
        json(
          res,
          stored ? (stored.created ? 201 : 200) : status,
          stored ? { ...publicReply(stored.reply, visitorId), request } : { error },
          cookieHeader,
        );
        return;
      }
      res.writeHead(303, { location: stored ? `/#trace-${traceId}` : "/", ...cookieHeader });
      res.end();
      return;
    }

    if (url.pathname === "/traces" && req.method === "GET") {
      json(res, 200, recentTraces().map((t) => publicTrace(t, visitorId)), cookieHeader);
      return;
    }

    if (url.pathname === "/snapshot" && req.method === "GET") {
      json(res, 200, snapshot(visitorId), { "cache-control": "no-store", ...cookieHeader });
      return;
    }

    if (url.pathname === "/events" && req.method === "GET") {
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      res.write("retry: 3000\n\n");
      // A reconnecting EventSource says where it got up to; a fresh one says
      // which cursor its page was rendered at. Either way it hears everything
      // after that before anything new, so nothing falls into the gap.
      const header = req.headers["last-event-id"];
      const since = parseCursor(Array.isArray(header) ? header[0] : header) ?? parseCursor(url.searchParams.get("since"));
      const now = currentCursor();
      if (since) {
        const missed = missedSince(since, REPLAY_LIMIT);
        if (missed.overflow) {
          res.write(sse("reset", { cursor: formatCursor(now) }, formatCursor(now)));
        } else {
          // traces first, so every replayed reply's thought is already there; each
          // carries the cursor just after it, so a drop mid-replay resumes in place
          const at = { ...since };
          for (const t of missed.traces) {
            at.trace = t.id;
            res.write(sse("trace", traceEvent(t), formatCursor(at)));
          }
          for (const r of missed.replies) {
            at.reply = r.id;
            res.write(sse("reply", replyEvent(r), formatCursor(at)));
          }
          res.write(sse("synced", { missed: missed.traces.length + missed.replies.length }, formatCursor(now)));
        }
      } else {
        res.write(sse("synced", { missed: 0 }, formatCursor(now)));
      }
      listeners.add(res);
      req.on("close", () => listeners.delete(res));
      return;
    }

    if (url.pathname === "/readme/" && req.method === "GET") {
      const md = readFileSync("README.md", "utf8");
      const html = renderReadme(await marked.parse(md));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "GET" && (await serveStatic(url.pathname, req, res))) return;

    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found");
  } catch (err) {
    console.error(err);
    if (res.headersSent) {
      res.end();
      return;
    }
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("internal error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`listening on ${PORT}`);
});

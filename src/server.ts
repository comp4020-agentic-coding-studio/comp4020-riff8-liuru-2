import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, normalize, resolve, sep } from "node:path";
import { marked } from "marked";
import { addTrace, isKind, recentTraces, type Trace } from "./db.ts";
import { publicTrace, renderReadme, renderWall } from "./templates.ts";

const PORT = Number(process.env.PORT ?? 8080);
const VISITOR_COOKIE = "visitor";
const FIVE_YEARS = 60 * 60 * 24 * 365 * 5;
// A trace is at most 240 characters; anything far past that is not a trace.
const MAX_BODY = 16 * 1024;

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

// URL prefix -> directory it may read from. Nothing outside these is served.
const STATIC_ROOTS: Record<string, string> = {
  "/static/": resolve("public"),
  "/assets/": resolve("assets"),
};

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
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
      const etag = `"${info.size.toString(36)}-${info.mtimeMs.toString(36)}"`;
      const headers = { etag, "cache-control": "no-cache" };
      if (req.headers["if-none-match"] === etag) {
        res.writeHead(304, headers);
        res.end();
        return true;
      }
      const body = await readFile(file);
      res.writeHead(200, { ...headers, "content-type": type, "content-length": body.length });
      res.end(body);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// Everyone with the page open holds one of these; a new trace goes to all of
// them, so the orb fills while you watch rather than on your next reload.
const listeners = new Set<ServerResponse>();

function broadcast(trace: Trace): void {
  const data = `event: trace\ndata: ${JSON.stringify(publicTrace(trace, ""))}\n\n`;
  for (const res of listeners) res.write(data);
}

setInterval(() => {
  for (const res of listeners) res.write(": still here\n\n");
}, 25_000).unref();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const cookies = parseCookies(req.headers.cookie);
  const existingVisitor = cookies[VISITOR_COOKIE];
  const visitorId = existingVisitor ?? randomUUID();
  const setCookie = existingVisitor ? undefined : visitorCookie(visitorId);
  const cookieHeader = setCookie ? { "set-cookie": setCookie } : {};

  try {
    if (url.pathname === "/" && req.method === "GET") {
      const html = renderWall(recentTraces(), visitorId);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", ...cookieHeader });
      res.end(html);
      return;
    }

    if (url.pathname === "/trace" && req.method === "POST") {
      const raw = await readBody(req);
      const params = new URLSearchParams(raw);
      const kind = params.get("kind") ?? "";
      const text = (params.get("text") ?? "").trim().slice(0, 240);
      const valid = isKind(kind) && text.length > 0;
      const trace = valid ? addTrace(visitorId, kind, text) : undefined;
      if (trace) broadcast(trace);

      if (wantsJson(req)) {
        res.writeHead(trace ? 201 : 400, {
          "content-type": "application/json; charset=utf-8",
          ...cookieHeader,
        });
        res.end(
          JSON.stringify(
            trace
              ? publicTrace(trace, visitorId)
              : { error: "a trace needs one of the six kinds and some text" },
          ),
        );
        return;
      }

      // The plain form path: a bad submission is silently dropped, and either
      // way the visitor lands back on the wall.
      res.writeHead(303, { location: "/", ...cookieHeader });
      res.end();
      return;
    }

    if (url.pathname === "/traces" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", ...cookieHeader });
      res.end(JSON.stringify(recentTraces().map((t) => publicTrace(t, visitorId))));
      return;
    }

    if (url.pathname === "/events" && req.method === "GET") {
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      res.write("retry: 3000\n\n");
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

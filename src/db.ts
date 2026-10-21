import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";

export const KINDS = ["dream", "illusion", "bubble", "shadow", "dew", "lightning"] as const;
export type Kind = (typeof KINDS)[number];

export const MAX_TEXT = 240;

export interface Trace {
  id: number;
  visitorId: string;
  kind: Kind;
  text: string;
  createdAt: number;
  requestId?: string | null;
}

export interface Reply {
  id: number;
  traceId: number;
  visitorId: string;
  text: string;
  createdAt: number;
  requestId?: string | null;
}

export function isKind(value: string): value is Kind {
  return (KINDS as readonly string[]).includes(value);
}

const dataDir = process.env.DATA_DIR ?? "./data";
mkdirSync(dataDir, { recursive: true });

const dbPath = `${dataDir}/app.db`;
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS traces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

// Migrations for walls that already hold traces: each step is safe to run on
// every boot, and none rewrites a row that is already there.
const traceColumns = (db.prepare("PRAGMA table_info(traces)").all() as { name: string }[]).map((c) => c.name);
if (!traceColumns.includes("request_id")) db.exec("ALTER TABLE traces ADD COLUMN request_id TEXT");
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS traces_request ON traces (request_id) WHERE request_id IS NOT NULL;
  CREATE TABLE IF NOT EXISTS replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id INTEGER NOT NULL REFERENCES traces (id),
    visitor_id TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    request_id TEXT
  );
  CREATE INDEX IF NOT EXISTS replies_trace ON replies (trace_id, id);
  CREATE UNIQUE INDEX IF NOT EXISTS replies_request ON replies (request_id) WHERE request_id IS NOT NULL;
`);

const TRACE_COLS = "id, visitor_id AS visitorId, kind, text, created_at AS createdAt, request_id AS requestId";
const REPLY_COLS = "id, trace_id AS traceId, visitor_id AS visitorId, text, created_at AS createdAt, request_id AS requestId";

const insertTrace = db.prepare(
  "INSERT INTO traces (visitor_id, kind, text, created_at, request_id) VALUES (?, ?, ?, ?, ?)",
);
const traceByRequest = db.prepare(`SELECT ${TRACE_COLS} FROM traces WHERE request_id = ?`);

/**
 * Stores a trace, or hands back the one already stored under the same request
 * id: a retried post is the same thought, not a second one. The id is the
 * client's random UUID and unique across the table, not per visitor, so a
 * retry still matches if the first answer (and the cookie it set) was lost.
 * `created` says which happened.
 */
export const addTrace = db.transaction(
  (visitorId: string, kind: Kind, text: string, requestId: string | null = null): { trace: Trace; created: boolean } => {
    if (requestId) {
      const existing = traceByRequest.get(requestId) as Trace | undefined;
      if (existing) return { trace: existing, created: false };
    }
    const createdAt = Date.now();
    const { lastInsertRowid } = insertTrace.run(visitorId, kind, text, createdAt, requestId);
    return { trace: { id: Number(lastInsertRowid), visitorId, kind, text, createdAt, requestId }, created: true };
  },
);

const selectRecent = db.prepare(`SELECT ${TRACE_COLS} FROM traces ORDER BY id DESC LIMIT ?`);

export function recentTraces(limit = 200): Trace[] {
  return selectRecent.all(limit) as Trace[];
}

const traceById = db.prepare(`SELECT ${TRACE_COLS} FROM traces WHERE id = ?`);

export function getTrace(id: number): Trace | undefined {
  return traceById.get(id) as Trace | undefined;
}

const insertReply = db.prepare(
  "INSERT INTO replies (trace_id, visitor_id, text, created_at, request_id) VALUES (?, ?, ?, ?, ?)",
);
const replyByRequest = db.prepare(`SELECT ${REPLY_COLS} FROM replies WHERE request_id = ?`);

/** As addTrace, for a reply; undefined when the thought it answers isn't on the wall. */
export const addReply = db.transaction(
  (traceId: number, visitorId: string, text: string, requestId: string | null = null): { reply: Reply; created: boolean } | undefined => {
    if (requestId) {
      const existing = replyByRequest.get(requestId) as Reply | undefined;
      if (existing) return { reply: existing, created: false };
    }
    if (!getTrace(traceId)) return undefined;
    const createdAt = Date.now();
    const { lastInsertRowid } = insertReply.run(traceId, visitorId, text, createdAt, requestId);
    return { reply: { id: Number(lastInsertRowid), traceId, visitorId, text, createdAt, requestId }, created: true };
  },
);

const selectRepliesFrom = db.prepare(`SELECT ${REPLY_COLS} FROM replies WHERE trace_id >= ? ORDER BY id ASC`);

/** Every reply to these traces, oldest first. */
export function repliesFor(traces: Trace[]): Reply[] {
  if (!traces.length) return [];
  const ids = new Set(traces.map((t) => t.id));
  const oldest = Math.min(...ids);
  return (selectRepliesFrom.all(oldest) as Reply[]).filter((r) => ids.has(r.traceId));
}

// ---------------------------------------------------------------- the cursor

/**
 * Where a page is up to: the newest trace and newest reply it has seen. Both
 * ids only ever grow (AUTOINCREMENT never reuses one), so "everything after
 * this cursor" is exactly what a page that saw this cursor has missed.
 */
export interface Cursor {
  trace: number;
  reply: number;
}

const maxIds = db.prepare(
  "SELECT (SELECT coalesce(max(id), 0) FROM traces) AS trace, (SELECT coalesce(max(id), 0) FROM replies) AS reply",
);

export function currentCursor(): Cursor {
  return maxIds.get() as Cursor;
}

export const formatCursor = (c: Cursor): string => `${c.trace}.${c.reply}`;

export function parseCursor(s: string | null | undefined): Cursor | undefined {
  const m = /^(\d{1,15})\.(\d{1,15})$/.exec(s ?? "");
  return m ? { trace: Number(m[1]), reply: Number(m[2]) } : undefined;
}

const tracesAfter = db.prepare(`SELECT ${TRACE_COLS} FROM traces WHERE id > ? ORDER BY id ASC LIMIT ?`);
const repliesAfter = db.prepare(`SELECT ${REPLY_COLS} FROM replies WHERE id > ? ORDER BY id ASC LIMIT ?`);

/**
 * What a page at `since` has missed, oldest first, or `overflow` when that is
 * more than `limit` of either: too much to replay one event at a time.
 */
export function missedSince(since: Cursor, limit: number): { traces: Trace[]; replies: Reply[]; overflow: boolean } {
  const traces = tracesAfter.all(since.trace, limit + 1) as Trace[];
  const replies = repliesAfter.all(since.reply, limit + 1) as Reply[];
  if (traces.length > limit || replies.length > limit) return { traces: [], replies: [], overflow: true };
  return { traces, replies, overflow: false };
}

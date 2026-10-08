import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

export const KINDS = ["dream", "illusion", "bubble", "shadow", "dew", "lightning"] as const;
export type Kind = (typeof KINDS)[number];

export interface Trace {
  id: number;
  visitorId: string;
  kind: Kind;
  text: string;
  createdAt: number;
}

export function isKind(value: string): value is Kind {
  return (KINDS as readonly string[]).includes(value);
}

const dataDir = process.env.DATA_DIR ?? "./data";
mkdirSync(dataDir, { recursive: true });

const dbPath = `${dataDir}/app.db`;
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS traces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

const insertTrace = db.prepare(
  "INSERT INTO traces (visitor_id, kind, text, created_at) VALUES (?, ?, ?, ?)",
);

export function addTrace(visitorId: string, kind: Kind, text: string): void {
  insertTrace.run(visitorId, kind, text, Date.now());
}

const selectRecent = db.prepare(
  "SELECT id, visitor_id AS visitorId, kind, text, created_at AS createdAt FROM traces ORDER BY id DESC LIMIT ?",
);

export function recentTraces(limit = 200): Trace[] {
  return selectRecent.all(limit) as Trace[];
}

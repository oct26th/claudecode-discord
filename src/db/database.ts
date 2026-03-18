import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import type { Project, Session, SessionStatus } from "./types.js";

function resolveDbPath(): string {
  const envPath = process.env.DB_PATH;
  if (envPath) return envPath;

  const dir = path.join(os.homedir(), ".claude-discord-bot");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "data.db");
}

const DB_PATH = resolveDbPath();

let db: Database.Database;

// Retry wrapper for write operations
function safeWrite<T extends unknown[]>(label: string, fn: (...args: T) => void): (...args: T) => boolean {
  return (...args: T) => {
    for (let i = 0; i < 3; i++) {
      try {
        fn(...args);
        return true;
      } catch (err) {
        console.warn(`[db:${label}] attempt ${i + 1}/3 failed:`, err instanceof Error ? err.message : err);
      }
    }
    console.error(`[db:${label}] all 3 attempts failed`);
    return false;
  };
}

// Retry wrapper for read operations
function safeRead<T extends unknown[], R>(label: string, fallback: R, fn: (...args: T) => R): (...args: T) => R {
  return (...args: T) => {
    try {
      return fn(...args);
    } catch (err) {
      console.error(`[db:${label}] read failed:`, err instanceof Error ? err.message : err);
      return fallback;
    }
  };
}

export function initDatabase(): void {
  // Migrate: copy old data.db from cwd if it exists and new path is empty
  const oldPath = path.join(process.cwd(), "data.db");
  if (oldPath !== DB_PATH && fs.existsSync(oldPath) && !fs.existsSync(DB_PATH)) {
    console.log(`[db] Migrating database from ${oldPath} to ${DB_PATH}`);
    fs.copyFileSync(oldPath, DB_PATH);
    for (const ext of ["-wal", "-shm"]) {
      if (fs.existsSync(oldPath + ext)) {
        fs.copyFileSync(oldPath + ext, DB_PATH + ext);
      }
    }
  }

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  console.log(`[db] Database opened at ${DB_PATH}`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      channel_id TEXT PRIMARY KEY,
      project_path TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      auto_approve INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      channel_id TEXT REFERENCES projects(channel_id) ON DELETE CASCADE,
      session_id TEXT,
      status TEXT DEFAULT 'offline',
      last_activity TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrations: add new columns if they don't exist
  try { db.exec("ALTER TABLE projects ADD COLUMN model TEXT DEFAULT NULL"); } catch { /* column already exists */ }
  try { db.exec("ALTER TABLE projects ADD COLUMN mention_only INTEGER DEFAULT 0"); } catch { /* column already exists */ }
  try { db.exec("ALTER TABLE sessions ADD COLUMN turn_count INTEGER DEFAULT 0"); } catch { /* column already exists */ }
  try { db.exec("ALTER TABLE sessions ADD COLUMN total_cost_usd REAL DEFAULT 0"); } catch { /* column already exists */ }
}

export function getDb(): Database.Database {
  return db;
}

// Project queries
export const registerProject = safeWrite("registerProject", (
  channelId: string,
  projectPath: string,
  guildId: string,
): void => {
  db.prepare(`
    INSERT OR REPLACE INTO projects (channel_id, project_path, guild_id)
    VALUES (?, ?, ?)
  `).run(channelId, projectPath, guildId);
});

export const unregisterProject = safeWrite("unregisterProject", (channelId: string): void => {
  const txn = db.transaction(() => {
    db.prepare("DELETE FROM sessions WHERE channel_id = ?").run(channelId);
    db.prepare("DELETE FROM projects WHERE channel_id = ?").run(channelId);
  });
  txn();
});

export const getProject = safeRead("getProject", undefined as Project | undefined, (channelId: string): Project | undefined => {
  return db
    .prepare("SELECT * FROM projects WHERE channel_id = ?")
    .get(channelId) as Project | undefined;
});

export const getAllProjects = safeRead("getAllProjects", [] as Project[], (guildId: string): Project[] => {
  return db
    .prepare("SELECT * FROM projects WHERE guild_id = ?")
    .all(guildId) as Project[];
});

export const setAutoApprove = safeWrite("setAutoApprove", (
  channelId: string,
  autoApprove: boolean,
): void => {
  db.prepare("UPDATE projects SET auto_approve = ? WHERE channel_id = ?").run(
    autoApprove ? 1 : 0,
    channelId,
  );
});

export const setModel = safeWrite("setModel", (
  channelId: string,
  model: string | null,
): void => {
  db.prepare("UPDATE projects SET model = ? WHERE channel_id = ?").run(
    model,
    channelId,
  );
});

export const setMentionOnly = safeWrite("setMentionOnly", (
  channelId: string,
  mentionOnly: boolean,
): void => {
  db.prepare("UPDATE projects SET mention_only = ? WHERE channel_id = ?").run(
    mentionOnly ? 1 : 0,
    channelId,
  );
});

// Session queries
export const upsertSession = safeWrite("upsertSession", (
  id: string,
  channelId: string,
  sessionId: string | null,
  status: SessionStatus,
): void => {
  db.prepare(`
    INSERT OR REPLACE INTO sessions (id, channel_id, session_id, status, last_activity)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(id, channelId, sessionId, status);
});

export const getSession = safeRead("getSession", undefined as Session | undefined, (channelId: string): Session | undefined => {
  return db
    .prepare(
      "SELECT * FROM sessions WHERE channel_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(channelId) as Session | undefined;
});

export const updateSessionStatus = safeWrite("updateSessionStatus", (
  channelId: string,
  status: SessionStatus,
): void => {
  db.prepare(
    "UPDATE sessions SET status = ?, last_activity = datetime('now') WHERE channel_id = ?",
  ).run(status, channelId);
});

export const incrementTurnCount = safeWrite("incrementTurnCount", (channelId: string): void => {
  db.prepare("UPDATE sessions SET turn_count = turn_count + 1 WHERE channel_id = ?").run(channelId);
});

export const addSessionCost = safeWrite("addSessionCost", (channelId: string, cost: number): void => {
  db.prepare("UPDATE sessions SET total_cost_usd = total_cost_usd + ? WHERE channel_id = ?").run(cost, channelId);
});

export const clearSessionData = safeWrite("clearSessionData", (channelId: string): void => {
  db.prepare(
    "UPDATE sessions SET session_id = NULL, turn_count = 0, total_cost_usd = 0, last_activity = datetime('now') WHERE channel_id = ?",
  ).run(channelId);
});

export const getAllSessions = safeRead("getAllSessions", [] as (Session & { project_path: string })[], (guildId: string): (Session & { project_path: string })[] => {
  return db
    .prepare(`
      SELECT s.*, p.project_path FROM sessions s
      JOIN projects p ON s.channel_id = p.channel_id
      WHERE p.guild_id = ?
    `)
    .all(guildId) as (Session & { project_path: string })[];
});

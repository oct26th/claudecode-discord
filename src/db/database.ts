import Database from "better-sqlite3";
import path from "node:path";
import type { Project, Session, SessionStatus } from "./types.js";

const DB_PATH = path.join(process.cwd(), "data.db");

let db: Database.Database;

export function initDatabase(): void {
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

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
export function registerProject(
  channelId: string,
  projectPath: string,
  guildId: string,
): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO projects (channel_id, project_path, guild_id)
    VALUES (?, ?, ?)
  `);
  stmt.run(channelId, projectPath, guildId);
}

export function unregisterProject(channelId: string): void {
  db.prepare("DELETE FROM sessions WHERE channel_id = ?").run(channelId);
  db.prepare("DELETE FROM projects WHERE channel_id = ?").run(channelId);
}

export function getProject(channelId: string): Project | undefined {
  return db
    .prepare("SELECT * FROM projects WHERE channel_id = ?")
    .get(channelId) as Project | undefined;
}

export function getAllProjects(guildId: string): Project[] {
  return db
    .prepare("SELECT * FROM projects WHERE guild_id = ?")
    .all(guildId) as Project[];
}

export function setAutoApprove(
  channelId: string,
  autoApprove: boolean,
): void {
  db.prepare("UPDATE projects SET auto_approve = ? WHERE channel_id = ?").run(
    autoApprove ? 1 : 0,
    channelId,
  );
}

export function setModel(
  channelId: string,
  model: string | null,
): void {
  db.prepare("UPDATE projects SET model = ? WHERE channel_id = ?").run(
    model,
    channelId,
  );
}

export function setMentionOnly(
  channelId: string,
  mentionOnly: boolean,
): void {
  db.prepare("UPDATE projects SET mention_only = ? WHERE channel_id = ?").run(
    mentionOnly ? 1 : 0,
    channelId,
  );
}

// Session queries
export function upsertSession(
  id: string,
  channelId: string,
  sessionId: string | null,
  status: SessionStatus,
): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO sessions (id, channel_id, session_id, status, last_activity)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);
  stmt.run(id, channelId, sessionId, status);
}

export function getSession(channelId: string): Session | undefined {
  return db
    .prepare(
      "SELECT * FROM sessions WHERE channel_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(channelId) as Session | undefined;
}

export function updateSessionStatus(
  channelId: string,
  status: SessionStatus,
): void {
  db.prepare(
    "UPDATE sessions SET status = ?, last_activity = datetime('now') WHERE channel_id = ?",
  ).run(status, channelId);
}

export function incrementTurnCount(channelId: string): void {
  db.prepare("UPDATE sessions SET turn_count = turn_count + 1 WHERE channel_id = ?").run(channelId);
}

export function addSessionCost(channelId: string, cost: number): void {
  db.prepare("UPDATE sessions SET total_cost_usd = total_cost_usd + ? WHERE channel_id = ?").run(cost, channelId);
}

export function clearSessionData(channelId: string): void {
  db.prepare(
    "UPDATE sessions SET session_id = NULL, turn_count = 0, total_cost_usd = 0, last_activity = datetime('now') WHERE channel_id = ?",
  ).run(channelId);
}

export function getAllSessions(guildId: string): (Session & { project_path: string })[] {
  return db
    .prepare(`
      SELECT s.*, p.project_path FROM sessions s
      JOIN projects p ON s.channel_id = p.channel_id
      WHERE p.guild_id = ?
    `)
    .all(guildId) as (Session & { project_path: string })[];
}

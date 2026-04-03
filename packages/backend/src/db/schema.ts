import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export const initDb = (dbPath: string): Database.Database => {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      owner_user_id INTEGER,
      created_at INTEGER NOT NULL,
      last_seen INTEGER,
      FOREIGN KEY(owner_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS agent_api_keys (
      api_key TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      revoked_at INTEGER,
      FOREIGN KEY(agent_id) REFERENCES agents(agent_id)
    );

    CREATE TABLE IF NOT EXISTS agent_pair_codes (
      code TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      type TEXT NOT NULL,
      tool_name TEXT,
      tool_input TEXT,
      tool_output TEXT,
      success INTEGER,
      duration_ms INTEGER,
      raw TEXT NOT NULL,
      agent_id TEXT
    );

    CREATE TABLE IF NOT EXISTS memory_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      captured_at INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      content TEXT NOT NULL,
      word_count INTEGER,
      flagged INTEGER DEFAULT 0,
      flag_reason TEXT,
      agent_id TEXT
    );

    CREATE TABLE IF NOT EXISTS tool_stats (
      tool_name TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      call_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      fail_count INTEGER DEFAULT 0,
      total_duration_ms INTEGER DEFAULT 0,
      last_used INTEGER,
      PRIMARY KEY(tool_name, agent_id)
    );

    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
    CREATE INDEX IF NOT EXISTS idx_events_agent ON events(agent_id);
    CREATE INDEX IF NOT EXISTS idx_memory_agent ON memory_snapshots(agent_id);
  `);

  return db;
};

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export const initDb = (dbPath: string): Database.Database => {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
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
      raw TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memory_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      captured_at INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      content TEXT NOT NULL,
      word_count INTEGER,
      flagged INTEGER DEFAULT 0,
      flag_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS tool_stats (
      tool_name TEXT PRIMARY KEY,
      call_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      fail_count INTEGER DEFAULT 0,
      total_duration_ms INTEGER DEFAULT 0,
      last_used INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
  `);

  return db;
};

import crypto from 'node:crypto';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import type { EventRow, MemorySnapshotRow, ToolStatRow } from '../api/types.js';
import type { ParsedEvent } from '../collector/parser.js';

export class DbQueries {
  constructor(private readonly db: Database.Database, private readonly dbPath: string) {}

  private ensureAgent(agentId: string): void {
    this.db
      .prepare(
        `INSERT INTO agents (agent_id, display_name, created_at, last_seen)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(agent_id) DO UPDATE SET last_seen = excluded.last_seen`
      )
      .run(agentId, agentId, Date.now(), Date.now());
  }

  insertEvent(event: ParsedEvent): number {
    const agentId = event.agent_id ?? 'local-openclaw';
    this.ensureAgent(agentId);

    const insert = this.db.prepare(
      `INSERT INTO events (session_id, timestamp, type, tool_name, tool_input, tool_output, success, duration_ms, raw, agent_id)
       VALUES (@session_id, @timestamp, @type, @tool_name, @tool_input, @tool_output, @success, @duration_ms, @raw, @agent_id)`
    );

    const tx = this.db.transaction((input: ParsedEvent) => {
      const info = insert.run({ ...input, agent_id: agentId });
      if (input.type === 'gen_ai.tool.call' && input.tool_name) {
        this.db
          .prepare(
            `INSERT INTO tool_stats(tool_name, agent_id, call_count, success_count, fail_count, total_duration_ms, last_used)
             VALUES(@tool_name, @agent_id, 1, @success_count, @fail_count, @duration, @last_used)
             ON CONFLICT(tool_name, agent_id) DO UPDATE SET
             call_count = call_count + 1,
             success_count = success_count + @success_count,
             fail_count = fail_count + @fail_count,
             total_duration_ms = total_duration_ms + @duration,
             last_used = @last_used`
          )
          .run({
            tool_name: input.tool_name,
            agent_id: agentId,
            success_count: input.success === 1 ? 1 : 0,
            fail_count: input.success === 0 ? 1 : 0,
            duration: input.duration_ms ?? 0,
            last_used: input.timestamp
          });
      }
      return Number(info.lastInsertRowid);
    });

    return tx(event);
  }

  listEvents(params: { limit: number; offset: number; type?: string; since?: number; agentId?: string }): { total: number; events: EventRow[] } {
    const filters: string[] = [];
    const bind: Record<string, unknown> = { limit: params.limit, offset: params.offset };
    if (params.type) {
      filters.push('type = @type');
      bind.type = params.type;
    }
    if (params.since) {
      filters.push('timestamp >= @since');
      bind.since = params.since;
    }
    if (params.agentId) {
      filters.push('agent_id = @agent_id');
      bind.agent_id = params.agentId;
    }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const events = this.db.prepare(`SELECT * FROM events ${where} ORDER BY timestamp DESC LIMIT @limit OFFSET @offset`).all(bind) as EventRow[];
    const total = this.db.prepare(`SELECT COUNT(*) as c FROM events ${where}`).get(bind) as { c: number };
    return { total: total.c, events };
  }

  listToolStats(agentId?: string): ToolStatRow[] {
    if (!agentId) return [];
    return this.db.prepare('SELECT * FROM tool_stats WHERE agent_id = ? ORDER BY call_count DESC').all(agentId) as ToolStatRow[];
  }

  toolTimeline(hours: number, agentId?: string): Array<{ hour: string; calls: string }> {
    if (!agentId) return [];
    return this.db
      .prepare(
        `SELECT strftime('%Y-%m-%dT%H:00:00Z', timestamp / 1000, 'unixepoch') as hour,
                json_group_object(tool_name, count) as calls
         FROM (
           SELECT tool_name, (timestamp / 3600000) as hour_bucket, COUNT(*) as count,
                  MIN(timestamp) as timestamp
           FROM events
           WHERE type = 'gen_ai.tool.call'
             AND timestamp >= @since
             AND tool_name IS NOT NULL
             AND agent_id = @agent_id
           GROUP BY tool_name, hour_bucket
         )
         GROUP BY hour
         ORDER BY hour ASC`
      )
      .all({ since: Date.now() - hours * 3600 * 1000, agent_id: agentId }) as Array<{ hour: string; calls: string }>;
  }

  insertMemorySnapshot(input: Omit<MemorySnapshotRow, 'id'> & { agent_id?: string }): number {
    const agentId = input.agent_id ?? 'local-openclaw';
    this.ensureAgent(agentId);
    const info = this.db
      .prepare(
        `INSERT INTO memory_snapshots (captured_at, file_path, content, word_count, flagged, flag_reason, agent_id)
         VALUES (@captured_at, @file_path, @content, @word_count, @flagged, @flag_reason, @agent_id)`
      )
      .run({ ...input, agent_id: agentId });
    return Number(info.lastInsertRowid);
  }

  listMemoryFiles(agentId?: string) {
    if (!agentId) return [];
    return this.db
      .prepare(
        `SELECT file_path,
                MAX(captured_at) as last_modified,
                MAX(word_count) as word_count,
                SUM(flagged) as flag_count
         FROM memory_snapshots
         WHERE agent_id = ?
         GROUP BY file_path
         ORDER BY file_path ASC`
      )
      .all(agentId) as Array<{ file_path: string; last_modified: number; word_count: number; flag_count: number }>;
  }

  memoryByPath(filePath: string, agentId?: string): MemorySnapshotRow[] {
    if (!agentId) return [];
    return this.db
      .prepare('SELECT * FROM memory_snapshots WHERE file_path = ? AND agent_id = ? ORDER BY captured_at DESC LIMIT 50')
      .all(filePath, agentId) as MemorySnapshotRow[];
  }

  markMemoryFlag(snapshotId: number, reason: string): void {
    this.db.prepare('UPDATE memory_snapshots SET flagged = 1, flag_reason = ? WHERE id = ?').run(reason, snapshotId);
  }

  sessions(agentId?: string) {
    if (!agentId) return [];
    return this.db
      .prepare(
        `SELECT session_id as id,
                MIN(timestamp) as started_at,
                COUNT(*) as event_count,
                COUNT(DISTINCT tool_name) as tools_used
         FROM events
         WHERE agent_id = ?
         GROUP BY session_id
         ORDER BY started_at DESC`
      )
      .all(agentId) as Array<{ id: string; started_at: number; event_count: number; tools_used: number }>;
  }

  dbSizeMb(): number {
    if (!fs.existsSync(this.dbPath)) return 0;
    const sizeBytes = fs.statSync(this.dbPath).size;
    return Number((sizeBytes / (1024 * 1024)).toFixed(2));
  }

  createAuthCode(email: string): { code: string; expiresAt: number } {
    const normalized = email.trim().toLowerCase();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    this.db.prepare('INSERT INTO auth_codes (email, code, expires_at) VALUES (?, ?, ?)').run(normalized, code, expiresAt);
    return { code, expiresAt };
  }

  verifyAuthCode(email: string, code: string): { token: string; userId: number } | null {
    const normalized = email.trim().toLowerCase();
    const row = this.db
      .prepare(
        `SELECT * FROM auth_codes
         WHERE email = ? AND code = ? AND consumed_at IS NULL AND expires_at > ?
         ORDER BY id DESC LIMIT 1`
      )
      .get(normalized, code, Date.now()) as { id: number } | undefined;
    if (!row) return null;

    this.db.prepare('UPDATE auth_codes SET consumed_at = ? WHERE id = ?').run(Date.now(), row.id);
    this.db.prepare('INSERT INTO users (email, created_at) VALUES (?, ?) ON CONFLICT(email) DO NOTHING').run(normalized, Date.now());
    const user = this.db.prepare('SELECT id FROM users WHERE email = ?').get(normalized) as { id: number };

    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 30 * 24 * 3600 * 1000;
    this.db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(token, user.id, Date.now(), expiresAt);
    return { token, userId: user.id };
  }

  getSession(token: string): { user_id: number } | null {
    const row = this.db.prepare('SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?').get(token, Date.now()) as { user_id: number } | undefined;
    return row ?? null;
  }

  createPairCode(userId: number): { code: string; expiresAt: number } {
    const code = crypto.randomBytes(4).toString('hex');
    const expiresAt = Date.now() + 15 * 60 * 1000;
    this.db.prepare('INSERT INTO agent_pair_codes (code, user_id, expires_at) VALUES (?, ?, ?)').run(code, userId, expiresAt);
    return { code, expiresAt };
  }

  consumePairCode(code: string): number | null {
    const pair = this.db
      .prepare('SELECT user_id FROM agent_pair_codes WHERE code = ? AND consumed_at IS NULL AND expires_at > ?')
      .get(code, Date.now()) as { user_id: number } | undefined;
    if (!pair) return null;
    this.db.prepare('UPDATE agent_pair_codes SET consumed_at = ? WHERE code = ?').run(Date.now(), code);
    return pair.user_id;
  }

  connectAgent(userId: number, agentId: string, displayName?: string): string {
    const name = displayName?.trim() || agentId;
    this.db
      .prepare(
        `INSERT INTO agents (agent_id, display_name, owner_user_id, created_at, last_seen)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(agent_id) DO UPDATE SET owner_user_id = excluded.owner_user_id, display_name = excluded.display_name, last_seen = excluded.last_seen`
      )
      .run(agentId, name, userId, Date.now(), Date.now());

    const apiKey = `al_${crypto.randomBytes(24).toString('hex')}`;
    this.db.prepare('INSERT INTO agent_api_keys (api_key, agent_id, created_at) VALUES (?, ?, ?)').run(apiKey, agentId, Date.now());
    return apiKey;
  }

  getAgentByApiKey(apiKey: string): { agent_id: string } | null {
    const row = this.db
      .prepare('SELECT agent_id FROM agent_api_keys WHERE api_key = ? AND revoked_at IS NULL')
      .get(apiKey) as { agent_id: string } | undefined;
    return row ?? null;
  }

  userAgents(userId: number): Array<{ agent_id: string; display_name: string; last_seen: number | null }> {
    return this.db
      .prepare('SELECT agent_id, display_name, last_seen FROM agents WHERE owner_user_id = ? ORDER BY last_seen DESC')
      .all(userId) as Array<{ agent_id: string; display_name: string; last_seen: number | null }>;
  }

  runCleanup(): void {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 3600 * 1000;
    this.db.prepare('DELETE FROM events WHERE timestamp < ?').run(thirtyDaysAgo);
    this.db.prepare('DELETE FROM auth_codes WHERE expires_at < ?').run(Date.now());
    this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    this.db.prepare('DELETE FROM agent_pair_codes WHERE expires_at < ?').run(Date.now());

    const files = this.db.prepare('SELECT DISTINCT file_path, agent_id FROM memory_snapshots').all() as Array<{ file_path: string; agent_id: string }>;
    for (const file of files) {
      this.db.prepare(
        `DELETE FROM memory_snapshots
         WHERE file_path = ? AND agent_id = ?
           AND id NOT IN (
             SELECT id FROM memory_snapshots WHERE file_path = ? AND agent_id = ? ORDER BY captured_at DESC LIMIT 10
           )`
      ).run(file.file_path, file.agent_id, file.file_path, file.agent_id);
    }

    this.db.exec('VACUUM');
  }
}

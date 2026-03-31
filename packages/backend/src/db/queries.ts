import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { EventRow, MemorySnapshotRow, ToolStatRow } from '../api/types.js';
import type { ParsedEvent } from '../collector/parser.js';

export class DbQueries {
  constructor(private readonly db: Database.Database, private readonly dbPath: string) {}

  insertEvent(event: ParsedEvent): number {
    const insert = this.db.prepare(
      `INSERT INTO events (session_id, timestamp, type, tool_name, tool_input, tool_output, success, duration_ms, raw)
       VALUES (@session_id, @timestamp, @type, @tool_name, @tool_input, @tool_output, @success, @duration_ms, @raw)`
    );
    const tx = this.db.transaction((input: ParsedEvent) => {
      const info = insert.run(input);
      if (input.type === 'gen_ai.tool.call' && input.tool_name) {
        this.db
          .prepare(
            `INSERT INTO tool_stats(tool_name, call_count, success_count, fail_count, total_duration_ms, last_used)
             VALUES(@tool_name, 1, @success_count, @fail_count, @duration, @last_used)
             ON CONFLICT(tool_name) DO UPDATE SET
             call_count = call_count + 1,
             success_count = success_count + @success_count,
             fail_count = fail_count + @fail_count,
             total_duration_ms = total_duration_ms + @duration,
             last_used = @last_used`
          )
          .run({
            tool_name: input.tool_name,
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

  listEvents(params: { limit: number; offset: number; type?: string; since?: number }): { total: number; events: EventRow[] } {
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
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const events = this.db
      .prepare(`SELECT * FROM events ${where} ORDER BY timestamp DESC LIMIT @limit OFFSET @offset`)
      .all(bind) as EventRow[];
    const total = this.db.prepare(`SELECT COUNT(*) as c FROM events ${where}`).get(bind) as { c: number };
    return { total: total.c, events };
  }

  listToolStats(): ToolStatRow[] {
    return this.db.prepare('SELECT * FROM tool_stats ORDER BY call_count DESC').all() as ToolStatRow[];
  }

  toolTimeline(hours: number): Array<{ hour: string; calls: string }> {
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
           GROUP BY tool_name, hour_bucket
         )
         GROUP BY hour
         ORDER BY hour ASC`
      )
      .all({ since: Date.now() - hours * 3600 * 1000 }) as Array<{ hour: string; calls: string }>;
  }

  insertMemorySnapshot(input: Omit<MemorySnapshotRow, 'id'>): number {
    const info = this.db
      .prepare(
        `INSERT INTO memory_snapshots (captured_at, file_path, content, word_count, flagged, flag_reason)
         VALUES (@captured_at, @file_path, @content, @word_count, @flagged, @flag_reason)`
      )
      .run(input);
    return Number(info.lastInsertRowid);
  }

  listMemoryFiles() {
    return this.db
      .prepare(
        `SELECT file_path,
                MAX(captured_at) as last_modified,
                MAX(word_count) as word_count,
                SUM(flagged) as flag_count
         FROM memory_snapshots
         GROUP BY file_path
         ORDER BY file_path ASC`
      )
      .all() as Array<{ file_path: string; last_modified: number; word_count: number; flag_count: number }>;
  }

  memoryByPath(filePath: string): MemorySnapshotRow[] {
    return this.db
      .prepare('SELECT * FROM memory_snapshots WHERE file_path = ? ORDER BY captured_at DESC LIMIT 50')
      .all(filePath) as MemorySnapshotRow[];
  }

  markMemoryFlag(snapshotId: number, reason: string): void {
    this.db
      .prepare('UPDATE memory_snapshots SET flagged = 1, flag_reason = ? WHERE id = ?')
      .run(reason, snapshotId);
  }

  sessions() {
    return this.db
      .prepare(
        `SELECT session_id as id,
                MIN(timestamp) as started_at,
                COUNT(*) as event_count,
                COUNT(DISTINCT tool_name) as tools_used
         FROM events
         GROUP BY session_id
         ORDER BY started_at DESC`
      )
      .all() as Array<{ id: string; started_at: number; event_count: number; tools_used: number }>;
  }

  dbSizeMb(): number {
    if (!fs.existsSync(this.dbPath)) return 0;
    const sizeBytes = fs.statSync(this.dbPath).size;
    return Number((sizeBytes / (1024 * 1024)).toFixed(2));
  }

  runCleanup(): void {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 3600 * 1000;
    this.db.prepare('DELETE FROM events WHERE timestamp < ?').run(thirtyDaysAgo);

    const files = this.db.prepare('SELECT DISTINCT file_path FROM memory_snapshots').all() as Array<{ file_path: string }>;
    for (const file of files) {
      this.db.prepare(
        `DELETE FROM memory_snapshots
         WHERE file_path = ?
           AND id NOT IN (
             SELECT id FROM memory_snapshots WHERE file_path = ? ORDER BY captured_at DESC LIMIT 10
           )`
      ).run(file.file_path, file.file_path);
    }

    this.db.exec('VACUUM');
  }
}

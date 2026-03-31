import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DbQueries } from '../db/queries.js';
import type { GatewayCollector } from '../collector/gateway.js';

export const registerRoutes = (
  app: FastifyInstance,
  deps: { db: DbQueries; gateway: GatewayCollector; getLastEventTs: () => number | null }
): void => {
  const clients = new Set<{ write: (payload: string) => void; close: () => void }>();

  deps.gateway.on('event', (event) => {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const c of clients) c.write(payload);
  });

  app.get('/api/health', async () => ({
    status: 'ok',
    gateway_connected: deps.gateway.isConnected(),
    db_size_mb: deps.db.dbSizeMb()
  }));

  app.get('/api/events', async (req) => {
    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(500).default(100),
      offset: z.coerce.number().int().min(0).default(0),
      type: z.string().optional(),
      since: z.coerce.number().int().optional()
    });
    const query = schema.parse(req.query);
    return deps.db.listEvents(query);
  });

  app.get('/api/tools/stats', async () => {
    const tools = deps.db.listToolStats();
    return {
      tools,
      total_calls: tools.reduce((acc, t) => acc + t.call_count, 0),
      active_tools: tools.length
    };
  });

  app.get('/api/tools/timeline', async (req) => {
    const { hours } = z.object({ hours: z.coerce.number().int().min(1).max(168).default(24) }).parse(req.query);
    const rows = deps.db.toolTimeline(hours);
    return {
      buckets: rows.map((row) => ({ hour: row.hour, calls: row.calls ? JSON.parse(row.calls) : {} }))
    };
  });

  app.get('/api/memory/files', async () => {
    const files = deps.db.listMemoryFiles();
    return {
      files,
      total_flags: files.reduce((acc, f) => acc + Number(f.flag_count ?? 0), 0)
    };
  });

  app.get('/api/memory/file', async (req) => {
    const { path } = z.object({ path: z.string() }).parse(req.query);
    const snapshots = deps.db.memoryByPath(path);
    const latest = snapshots[0];
    const flags = snapshots
      .filter((s) => s.flagged)
      .flatMap((s) => {
        try {
          return JSON.parse(s.flag_reason ?? '[]').map((f: unknown) => ({ snapshot_id: s.id, ...((f as object) ?? {}) }));
        } catch {
          return [];
        }
      });

    return {
      content: latest?.content ?? '',
      snapshots,
      flags
    };
  });

  app.post('/api/memory/flag', async (req) => {
    const body = z.object({ snapshot_id: z.number().int(), reason: z.string().min(1) }).parse(req.body);
    deps.db.markMemoryFlag(body.snapshot_id, JSON.stringify([{ severity: 'medium', heuristic: 'manual_review', detail: body.reason }]));
    return { ok: true };
  });

  app.get('/api/sessions', async () => ({ sessions: deps.db.sessions() }));

  app.get('/api/status', async () => ({
    gateway_connected: deps.gateway.isConnected(),
    last_event_ts: deps.getLastEventTs(),
    active_session: deps.db.sessions()[0]?.id ?? null,
    total_events_today: deps.db.listEvents({ limit: 1, offset: 0, since: Date.now() - 24 * 3600 * 1000 }).total
  }));

  app.get('/api/stream', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    const client = {
      write: (payload: string) => reply.raw.write(payload),
      close: () => reply.raw.end()
    };
    clients.add(client);
    reply.raw.write('event: hello\ndata: {"ok":true}\n\n');

    req.raw.on('close', () => {
      clients.delete(client);
      client.close();
    });
  });
};

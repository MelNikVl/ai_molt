import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DbQueries } from '../db/queries.js';
import type { GatewayCollector } from '../collector/gateway.js';

type AuthedRequest = FastifyRequest & { userId: number; agentId?: string };

export const registerRoutes = (
  app: FastifyInstance,
  deps: { db: DbQueries; gateway: GatewayCollector; getLastEventTs: () => number | null }
): void => {
  const clients = new Set<{ write: (payload: string) => void; close: () => void; userId: number }>();

  const requireUser = (req: FastifyRequest, reply: FastifyReply): req is AuthedRequest => {
    const auth = req.headers.authorization;
    const queryToken = typeof (req.query as Record<string, unknown> | undefined)?.token === 'string'
      ? ((req.query as Record<string, unknown>).token as string)
      : null;
    const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : queryToken;
    if (!token) {
      reply.code(401).send({ error: 'missing_token' });
      return false;
    }
    const session = deps.db.getSession(token);
    if (!session) {
      reply.code(401).send({ error: 'invalid_token' });
      return false;
    }
    (req as AuthedRequest).userId = session.user_id;
    return true;
  };

  const resolveAgent = (req: FastifyRequest, userId: number): string | null => {
    const q = req.query as Record<string, unknown>;
    const requested = typeof q.agent_id === 'string' ? q.agent_id : undefined;
    const userAgents = deps.db.userAgents(userId);
    if (!userAgents.length) return null;
    if (!requested) return userAgents[0].agent_id;
    return userAgents.some((a) => a.agent_id === requested) ? requested : null;
  };

  deps.gateway.on('event', (event) => {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const c of clients) c.write(payload);
  });

  app.post('/api/auth/request-code', async (req) => {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const { code, expiresAt } = deps.db.createAuthCode(email);
    app.log.info({ email, code }, 'AgentLens login code');
    return {
      ok: true,
      delivery: 'console',
      expires_at: expiresAt,
      message: 'Код входа отправлен (в dev режиме смотрите backend логи).'
    };
  });

  app.post('/api/auth/verify-code', async (req, reply) => {
    const { email, code } = z.object({ email: z.string().email(), code: z.string().min(6).max(6) }).parse(req.body);
    const session = deps.db.verifyAuthCode(email, code);
    if (!session) return reply.code(401).send({ error: 'invalid_code' });
    return { token: session.token, user_id: session.userId };
  });

  app.get('/api/auth/me', async (req, reply) => {
    if (!requireUser(req, reply)) return;
    const userId = (req as AuthedRequest).userId;
    return { user_id: userId, agents: deps.db.userAgents(userId) };
  });

  app.post('/api/agents/pair-code', async (req, reply) => {
    if (!requireUser(req, reply)) return;
    const userId = (req as AuthedRequest).userId;
    const pair = deps.db.createPairCode(userId);
    return { code: pair.code, expires_at: pair.expiresAt };
  });

  app.post('/api/agents/connect', async (req, reply) => {
    const { pair_code, agent_id, display_name } = z
      .object({ pair_code: z.string().min(4), agent_id: z.string().min(2), display_name: z.string().optional() })
      .parse(req.body);
    const userId = deps.db.consumePairCode(pair_code);
    if (!userId) return reply.code(401).send({ error: 'invalid_or_expired_pair_code' });
    const apiKey = deps.db.connectAgent(userId, agent_id, display_name);
    return {
      ok: true,
      api_key: apiKey,
      ingest_url: '/api/agents/ingest/event',
      message: 'Agent connected to AgentLens.'
    };
  });

  app.post('/api/agents/ingest/event', async (req, reply) => {
    const header = req.headers['x-agent-key'];
    const apiKey = Array.isArray(header) ? header[0] : header;
    if (!apiKey) return reply.code(401).send({ error: 'missing_agent_key' });
    const linked = deps.db.getAgentByApiKey(apiKey);
    if (!linked) return reply.code(401).send({ error: 'invalid_agent_key' });

    const payload = z
      .object({
        session_id: z.string(),
        timestamp: z.number(),
        type: z.string(),
        tool_name: z.string().nullable().optional(),
        tool_input: z.string().nullable().optional(),
        tool_output: z.string().nullable().optional(),
        success: z.number().nullable().optional(),
        duration_ms: z.number().nullable().optional(),
        raw: z.string(),
        agent_id: z.string().optional()
      })
      .parse(req.body);

    deps.db.insertEvent({ ...payload, agent_id: linked.agent_id });
    return { ok: true };
  });

  app.get('/api/health', async (req, reply) => {
    if (!requireUser(req, reply)) return;
    return {
      status: 'ok',
      gateway_connected: deps.gateway.isConnected(),
      db_size_mb: deps.db.dbSizeMb()
    };
  });

  app.get('/api/events', async (req, reply) => {
    if (!requireUser(req, reply)) return;
    const authed = req as AuthedRequest;
    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(500).default(100),
      offset: z.coerce.number().int().min(0).default(0),
      type: z.string().optional(),
      since: z.coerce.number().int().optional(),
      agent_id: z.string().optional()
    });
    const query = schema.parse(req.query);
    const agentId = resolveAgent(req, authed.userId);
    return deps.db.listEvents({ ...query, agentId: query.agent_id ?? agentId ?? undefined });
  });

  app.get('/api/tools/stats', async (req, reply) => {
    if (!requireUser(req, reply)) return;
    const authed = req as AuthedRequest;
    const agentId = resolveAgent(req, authed.userId);
    const tools = deps.db.listToolStats(agentId ?? undefined);
    return {
      tools,
      total_calls: tools.reduce((acc, t) => acc + t.call_count, 0),
      active_tools: tools.length,
      agent_id: agentId
    };
  });

  app.get('/api/tools/timeline', async (req, reply) => {
    if (!requireUser(req, reply)) return;
    const authed = req as AuthedRequest;
    const { hours } = z.object({ hours: z.coerce.number().int().min(1).max(168).default(24) }).parse(req.query);
    const agentId = resolveAgent(req, authed.userId);
    const rows = deps.db.toolTimeline(hours, agentId ?? undefined);
    return {
      buckets: rows.map((row) => ({ hour: row.hour, calls: row.calls ? JSON.parse(row.calls) : {} })),
      agent_id: agentId
    };
  });

  app.get('/api/memory/files', async (req, reply) => {
    if (!requireUser(req, reply)) return;
    const authed = req as AuthedRequest;
    const agentId = resolveAgent(req, authed.userId);
    const files = deps.db.listMemoryFiles(agentId ?? undefined);
    return {
      files,
      total_flags: files.reduce((acc, f) => acc + Number(f.flag_count ?? 0), 0),
      agent_id: agentId
    };
  });

  app.get('/api/memory/file', async (req, reply) => {
    if (!requireUser(req, reply)) return;
    const authed = req as AuthedRequest;
    const { path } = z.object({ path: z.string() }).parse(req.query);
    const agentId = resolveAgent(req, authed.userId);
    const snapshots = deps.db.memoryByPath(path, agentId ?? undefined);
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

    return { content: latest?.content ?? '', snapshots, flags, agent_id: agentId };
  });

  app.post('/api/memory/flag', async (req, reply) => {
    if (!requireUser(req, reply)) return;
    const body = z.object({ snapshot_id: z.number().int(), reason: z.string().min(1) }).parse(req.body);
    deps.db.markMemoryFlag(body.snapshot_id, JSON.stringify([{ severity: 'medium', heuristic: 'manual_review', detail: body.reason }]));
    return { ok: true };
  });

  app.get('/api/sessions', async (req, reply) => {
    if (!requireUser(req, reply)) return;
    const authed = req as AuthedRequest;
    const agentId = resolveAgent(req, authed.userId);
    return { sessions: deps.db.sessions(agentId ?? undefined), agent_id: agentId };
  });

  app.get('/api/status', async (req, reply) => {
    if (!requireUser(req, reply)) return;
    const authed = req as AuthedRequest;
    const agentId = resolveAgent(req, authed.userId);
    return {
      gateway_connected: deps.gateway.isConnected(),
      last_event_ts: deps.getLastEventTs(),
      active_session: deps.db.sessions(agentId ?? undefined)[0]?.id ?? null,
      total_events_today: deps.db.listEvents({ limit: 1, offset: 0, since: Date.now() - 24 * 3600 * 1000, agentId: agentId ?? undefined }).total,
      agent_id: agentId
    };
  });

  app.get('/api/stream', async (req, reply) => {
    if (!requireUser(req, reply)) return;
    const authed = req as AuthedRequest;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    const client = {
      write: (payload: string) => reply.raw.write(payload),
      close: () => reply.raw.end(),
      userId: authed.userId
    };
    clients.add(client);
    reply.raw.write('event: hello\ndata: {"ok":true}\n\n');

    req.raw.on('close', () => {
      clients.delete(client);
      client.close();
    });
  });
};

import path from 'node:path';
import fs from 'node:fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { loadConfig } from './config.js';
import { initDb } from './db/schema.js';
import { DbQueries } from './db/queries.js';
import { GatewayCollector } from './collector/gateway.js';
import { startLogWatcher, startMemoryWatcher } from './collector/memory.js';
import { parseLogLine } from './collector/parser.js';
import { registerRoutes } from './api/routes.js';

const config = loadConfig();
const dbConn = initDb(config.db_path);
const db = new DbQueries(dbConn, config.db_path);
db.runCleanup();

let lastEventTs: number | null = null;

const gateway = new GatewayCollector(config.openclaw_gateway, db);
gateway.on('event', (event) => {
  lastEventTs = event.timestamp;
});
gateway.start();

const memoryPath = path.join(config.openclaw_workspace, 'memory');
if (fs.existsSync(memoryPath)) {
  startMemoryWatcher(memoryPath, db);
}
if (fs.existsSync(config.openclaw_logs)) {
  startLogWatcher(config.openclaw_logs, (line) => {
    const parsed = parseLogLine(line);
    if (!parsed) return;
    db.insertEvent(parsed);
    lastEventTs = parsed.timestamp;
  });
}

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
registerRoutes(app, { db, gateway, getLastEventTs: () => lastEventTs });

const publicDir = path.resolve('public');
if (fs.existsSync(publicDir)) {
  await app.register(fastifyStatic, { root: publicDir });
  app.get('/*', async (_, reply) => reply.sendFile('index.html'));
}

await app.listen({ port: config.api_port, host: '0.0.0.0' });

if (process.env.NODE_ENV !== 'production') {
  const target = `http://localhost:${config.frontend_port}`;
  console.log(`AgentLens backend listening. Open ${target}`);
}

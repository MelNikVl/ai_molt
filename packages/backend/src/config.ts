import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { z } from 'zod';

const ConfigSchema = z.object({
  openclaw_gateway: z.string().default('ws://127.0.0.1:18789'),
  openclaw_workspace: z.string().default('~/.openclaw/workspace'),
  openclaw_logs: z.string().default('~/.openclaw/logs'),
  db_path: z.string().default('~/.agentlens/agentlens.db'),
  api_port: z.number().int().default(47777),
  frontend_port: z.number().int().default(47778),
  log_level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  smtp_host: z.string().default(''),
  smtp_port: z.number().int().default(587),
  smtp_user: z.string().default(''),
  smtp_pass: z.string().default(''),
  smtp_from: z.string().default('')
});

export type AgentLensConfig = z.infer<typeof ConfigSchema>;

const expandHome = (value: string): string =>
  value.startsWith('~/') ? path.join(os.homedir(), value.slice(2)) : value;

const readOpenClawWorkspace = (): string | undefined => {
  const openclawConfigPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
  if (!fs.existsSync(openclawConfigPath)) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(openclawConfigPath, 'utf8')) as Record<string, unknown>;
    const raw = parsed.workspace ?? parsed.workspaceDir;
    return typeof raw === 'string' ? raw : undefined;
  } catch {
    return undefined;
  }
};

export const loadConfig = (): AgentLensConfig => {
  const configDir = path.join(os.homedir(), '.agentlens');
  const configPath = path.join(configDir, 'config.json');
  fs.mkdirSync(configDir, { recursive: true });

  const detectedWorkspace = readOpenClawWorkspace() ?? '~/.openclaw/workspace';

  const defaults: AgentLensConfig = {
    openclaw_gateway: 'ws://127.0.0.1:18789',
    openclaw_workspace: detectedWorkspace,
    openclaw_logs: '~/.openclaw/logs',
    db_path: '~/.agentlens/agentlens.db',
    api_port: 47777,
    frontend_port: 47778,
    log_level: 'info',
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_pass: '',
    smtp_from: ''
  };

  let fileConfig: Partial<AgentLensConfig> = {};
  if (fs.existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Partial<AgentLensConfig>;
    } catch {
      fileConfig = {};
    }
  }

  const merged = ConfigSchema.parse({ ...defaults, ...fileConfig });
  const expanded: AgentLensConfig = {
    ...merged,
    openclaw_workspace: expandHome(merged.openclaw_workspace),
    openclaw_logs: expandHome(merged.openclaw_logs),
    db_path: expandHome(merged.db_path)
  };

  fs.writeFileSync(configPath, JSON.stringify({ ...defaults, ...fileConfig }, null, 2));
  return expanded;
};

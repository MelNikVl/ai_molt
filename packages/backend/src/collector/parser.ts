import { z } from 'zod';
import type { EventType } from '../api/types.js';

const AnyEventSchema = z.record(z.string(), z.unknown());

export interface ParsedEvent {
  session_id: string;
  timestamp: number;
  type: EventType;
  tool_name: string | null;
  tool_input: string | null;
  tool_output: string | null;
  success: number | null;
  duration_ms: number | null;
  raw: string;
}

const normType = (value: unknown): EventType => {
  if (typeof value !== 'string') return 'unknown';
  const v = value.toLowerCase();
  if (v.includes('tool')) return 'gen_ai.tool.call';
  if (v.includes('llm') && v.includes('request')) return 'gen_ai.llm.request';
  if (v.includes('llm') && (v.includes('response') || v.includes('completion'))) return 'gen_ai.llm.response';
  if (v.includes('message') && (v.includes('in') || v.includes('incoming'))) return 'message_in';
  if (v.includes('message') && (v.includes('out') || v.includes('outgoing'))) return 'message_out';
  if (v.includes('heartbeat') || v.includes('tick')) return 'heartbeat';
  if (v.includes('session') && v.includes('start')) return 'session_start';
  if (v.includes('session') && (v.includes('stop') || v.includes('end'))) return 'session_stop';
  return 'unknown';
};

export const parseGatewayPayload = (payload: string): ParsedEvent => {
  const fallback: ParsedEvent = {
    session_id: 'unknown',
    timestamp: Date.now(),
    type: 'unknown',
    tool_name: null,
    tool_input: null,
    tool_output: null,
    success: null,
    duration_ms: null,
    raw: payload
  };

  try {
    const json = JSON.parse(payload) as unknown;
    const safe = AnyEventSchema.safeParse(json);
    if (!safe.success) return fallback;

    const event = safe.data;
    const session_id =
      (typeof event.session_id === 'string' && event.session_id) ||
      (typeof event.sessionId === 'string' && event.sessionId) ||
      'unknown';
    const timestamp =
      (typeof event.timestamp === 'number' && event.timestamp) ||
      (typeof event.ts === 'number' && event.ts) ||
      Date.now();

    const toolNameCandidate =
      (typeof event.tool_name === 'string' && event.tool_name) ||
      (typeof event.toolName === 'string' && event.toolName) ||
      (typeof event.tool === 'string' && event.tool) ||
      null;

    const parsed: ParsedEvent = {
      session_id,
      timestamp,
      type: normType(event.type ?? event.event ?? event.name),
      tool_name: toolNameCandidate,
      tool_input: event.input !== undefined ? JSON.stringify(event.input) : null,
      tool_output: event.output !== undefined ? JSON.stringify(event.output) : null,
      success:
        typeof event.success === 'boolean' ? (event.success ? 1 : 0) : typeof event.ok === 'boolean' ? (event.ok ? 1 : 0) : null,
      duration_ms:
        typeof event.duration_ms === 'number'
          ? event.duration_ms
          : typeof event.duration === 'number'
            ? event.duration
            : null,
      raw: payload
    };

    if (parsed.type === 'unknown' && parsed.tool_name) parsed.type = 'gen_ai.tool.call';
    return parsed;
  } catch {
    return fallback;
  }
};

export const parseLogLine = (line: string): ParsedEvent | null => {
  const tsMatch = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/);
  const timestamp = tsMatch ? new Date(tsMatch[0]).getTime() : Date.now();

  const toolMatch = line.match(/tool(?:_call)?[:=\s]+([\w.-]+)/i);
  const llmReq = /llm.*request/i.test(line);
  const llmRes = /llm.*response|completion/i.test(line);

  if (!toolMatch && !llmReq && !llmRes) return null;

  return {
    session_id: 'log-parser',
    timestamp,
    type: toolMatch ? 'gen_ai.tool.call' : llmReq ? 'gen_ai.llm.request' : 'gen_ai.llm.response',
    tool_name: toolMatch?.[1] ?? null,
    tool_input: null,
    tool_output: null,
    success: /success|ok/i.test(line) ? 1 : /fail|error/i.test(line) ? 0 : null,
    duration_ms: (() => {
      const m = line.match(/(\d+)ms/);
      return m ? Number(m[1]) : null;
    })(),
    raw: JSON.stringify({ source: 'log', line })
  };
};

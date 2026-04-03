export type EventType =
  | 'gen_ai.tool.call'
  | 'gen_ai.llm.request'
  | 'gen_ai.llm.response'
  | 'message_in'
  | 'message_out'
  | 'heartbeat'
  | 'session_start'
  | 'session_stop'
  | 'unknown';

export interface EventRow {
  id: number;
  session_id: string;
  timestamp: number;
  type: EventType;
  tool_name: string | null;
  tool_input: string | null;
  tool_output: string | null;
  success: number | null;
  duration_ms: number | null;
  raw: string;
  agent_id: string | null;
}

export interface ToolStatRow {
  tool_name: string;
  agent_id: string;
  call_count: number;
  success_count: number;
  fail_count: number;
  total_duration_ms: number;
  last_used: number | null;
}

export interface MemorySnapshotRow {
  id: number;
  captured_at: number;
  file_path: string;
  content: string;
  word_count: number | null;
  flagged: number;
  flag_reason: string | null;
  agent_id: string | null;
}

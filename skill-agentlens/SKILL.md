# AgentLens Skill

Use AgentLens to introspect OpenClaw behavior through local HTTP APIs on `http://localhost:47777`.

## Capabilities

1. **Tool usage stats**
   - Ask: "what tools have I used today?"
   - Call: `GET /api/tools/stats`
   - Summarize top tools, success rates, and stale tools.

2. **Memory health checks**
   - Ask: "are there any memory flags?"
   - Call: `GET /api/memory/files`
   - If flagged files exist, inspect with `GET /api/memory/file?path=<encoded_path>`.

3. **Recent activity timeline**
   - Ask: "what did I do in the last hour?"
   - Call: `GET /api/events?since=<now_minus_1h>&limit=200`
   - Group by event type and include tool call outcomes.

## Usage Notes

- AgentLens is local-first and has no auth by default.
- If the API is down, report: `AgentLens not reachable at http://localhost:47777`.
- Prefer concise summaries with timestamps, session IDs, and anomalies.

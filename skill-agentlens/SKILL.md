# AgentLens Skill

Use AgentLens API on `http://localhost:47777`.

## Login + Linking prerequisite

1. Human logs into AgentLens web UI by email code.
2. Human generates pair code in UI.
3. Agent runs:

```bash
curl -X POST http://localhost:47777/api/agents/connect \
  -H 'Content-Type: application/json' \
  -d '{"pair_code":"<pair_code>","agent_id":"openclaw-main","display_name":"OpenClaw Main"}'
```

Store returned `api_key` and send it in `x-agent-key` for ingest endpoints.

## Capabilities

1. **Tool usage stats**
   - `GET /api/tools/stats` (with user Bearer token)
2. **Memory health checks**
   - `GET /api/memory/files`
   - `GET /api/memory/file?path=<encoded_path>`
3. **Recent timeline**
   - `GET /api/events?since=<now_minus_1h>&limit=200`

## Agent event ingest

```bash
curl -X POST http://localhost:47777/api/agents/ingest/event \
  -H "Content-Type: application/json" \
  -H "x-agent-key: <api_key>" \
  -d '{"session_id":"s1","timestamp":1710000000000,"type":"gen_ai.tool.call","raw":"{}"}'
```

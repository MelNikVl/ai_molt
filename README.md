# AgentLens

![MIT License](https://img.shields.io/badge/license-MIT-green.svg)

**See what your OpenClaw agent actually does.**

<!-- ADD DEMO GIF HERE -->

## Quick start

```bash
pnpm install
pnpm dev
open http://localhost:47778
```

## Architecture

```text
┌────────────────────────────── User Browser ───────────────────────────────┐
│ Email login (OTP) -> Session token -> Agent dashboard per linked agent    │
└──────────────────────────────────┬─────────────────────────────────────────┘
                                   │
                        ┌──────────▼──────────┐
                        │  AgentLens Backend  │
                        │ Fastify + SQLite    │
                        ├──────────────────────┤
                        │ Auth: users/sessions │
                        │ Pairing: pair code   │
                        │ Ingest: x-agent-key  │
                        └───┬───────────────┬──┘
                            │               │
                 ws://127.0.0.1:18789   /api/agents/ingest/*
                     (OpenClaw)          (remote/local agent)
                            │               │
                            └───────┬───────┘
                                    ▼
                              agentlens.db
```

## Agent ↔ Email linking flow

1. User logs in via email code (`/api/auth/request-code`, `/api/auth/verify-code`).
2. User generates pair code in UI (`/api/agents/pair-code`).
3. Agent executes one command to connect:
   ```bash
   curl -X POST http://localhost:47777/api/agents/connect \
     -H 'Content-Type: application/json' \
     -d '{"pair_code":"<code>","agent_id":"openclaw-main"}'
   ```
4. Agent receives `api_key` and can push events to `/api/agents/ingest/event`.
5. User sees only linked agents after login.

## Screenshots

- `docs/screenshots/timeline.png` (placeholder)
- `docs/screenshots/tool-pulse.png` (placeholder)
- `docs/screenshots/memory-guard.png` (placeholder)

## What AgentLens shows you

- **Tool Pulse:** Which tools are hot, healthy, failing, or stale.
- **Memory Guard:** Snapshot history and corruption heuristics for markdown memory.
- **Timeline:** Live, chronological event feed from gateway/log ingestion.

## Contributing

1. Fork and clone.
2. Run `pnpm install` and `pnpm dev`.
3. Open a PR with tests/checks and screenshots for UI changes.

## License

MIT

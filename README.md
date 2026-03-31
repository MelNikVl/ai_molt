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
                 ┌─────────────────────────────┐
                 │       OpenClaw Gateway      │
                 │       ws://127.0.0.1:18789  │
                 └──────────────┬──────────────┘
                                │ events
                    ┌───────────▼───────────┐
                    │  AgentLens Backend    │
                    │ Fastify + ws + SQLite │
                    └───┬───────────────┬───┘
                        │               │
                 chokidar memory   chokidar logs
                        │               │
                    ┌───▼───────────────▼───┐
                    │      agentlens.db      │
                    └───────────┬────────────┘
                                │ REST + SSE
                        ┌───────▼────────┐
                        │ React Dashboard │
                        │  localhost:47778│
                        └─────────────────┘
```

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

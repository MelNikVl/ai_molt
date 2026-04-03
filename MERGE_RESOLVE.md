# Merge conflict resolution guide (AgentLens)

If GitHub shows conflicts for these files:

- `README.md`
- `packages/backend/src/api/routes.ts`
- `packages/backend/src/api/types.ts`
- `packages/backend/src/collector/parser.ts`
- `packages/backend/src/db/queries.ts`
- `packages/backend/src/db/schema.ts`
- `packages/frontend/src/App.tsx`
- `packages/frontend/src/components/Timeline.tsx`
- `packages/frontend/src/hooks/useAgentData.ts`
- `packages/frontend/src/lib/api.ts`
- `skill-agentlens/SKILL.md`

## Resolution policy

Use **both** changes where possible, but keep these final decisions:

1. Keep auth-aware imports in `routes.ts`:
   - `FastifyInstance, FastifyReply, FastifyRequest`
   - `AuthedRequest` type with `userId`
2. Keep email auth routes (`/api/auth/request-code`, `/api/auth/verify-code`, `/api/auth/me`).
3. Keep agent linking routes (`/api/agents/pair-code`, `/api/agents/connect`) and ingest by `x-agent-key`.
4. Keep `ParsedEvent.agent_id?: string` in `parser.ts`.
5. Keep `agent_id` columns/filters in `events`, `memory_snapshots`, `tool_stats` and all related query methods.
6. Keep frontend token helpers in `lib/api.ts` and authorized requests.
7. Keep `useAgentData.ts` with `enabled` flags to avoid pre-login requests.
8. Keep `App.tsx` auth gate (`isAuthed`) and linked-agent selector.
9. Keep SSE auth via `/api/stream?token=...` in `Timeline.tsx`.
10. Keep README/SKILL sections that describe email login + pair-code + connect command.

## Quick local conflict command flow

```bash
git fetch origin
git merge origin/main
# resolve files from policy above
git add README.md packages/backend/src/api/routes.ts packages/backend/src/api/types.ts \
  packages/backend/src/collector/parser.ts packages/backend/src/db/queries.ts \
  packages/backend/src/db/schema.ts packages/frontend/src/App.tsx \
  packages/frontend/src/components/Timeline.tsx packages/frontend/src/hooks/useAgentData.ts \
  packages/frontend/src/lib/api.ts skill-agentlens/SKILL.md
git commit -m "chore: resolve merge conflicts with main"
```

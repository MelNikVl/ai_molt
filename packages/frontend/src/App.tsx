import { useMemo, useState } from 'react';
import { StatusBar } from './components/StatusBar';
import { Timeline } from './components/Timeline';
import { ToolPulse } from './components/ToolPulse';
import { MemoryGuard } from './components/MemoryGuard';
import { AgentConnect } from './components/AgentConnect';
import { AuthPanel } from './components/AuthPanel';
import { useEvents, useMe, useMemoryFile, useMemoryFiles, useStatus, useToolStats, useToolTimeline } from './hooks/useAgentData';
import { clearToken, getToken } from './lib/api';

const tabs = ['Timeline', 'Tool Pulse', 'Memory Guard', 'Settings'] as const;

export default function App() {
  const [tab, setTab] = useState<(typeof tabs)[number]>('Timeline');
  const [selectedFile, setSelectedFile] = useState<string>();
  const [authTick, setAuthTick] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState<string>();

  const token = getToken();
  const isAuthed = Boolean(token);
  const me = useMe(isAuthed);
  const agentId = useMemo(() => selectedAgent ?? me.data?.agents?.[0]?.agent_id, [selectedAgent, me.data]);

  const status = useStatus(agentId, isAuthed).data;
  const events = useEvents(agentId, undefined, isAuthed).data;
  const toolStats = useToolStats(agentId, isAuthed).data;
  const toolTimeline = useToolTimeline(agentId, isAuthed).data;
  const memoryFiles = useMemoryFiles(agentId, isAuthed).data;
  const memoryFile = useMemoryFile(selectedFile, agentId, isAuthed).data;

  if (!isAuthed) {
    return <AuthPanel onAuthed={() => setAuthTick((x) => x + 1)} key={authTick} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <StatusBar status={status} />
      <div className="grid grid-cols-12">
        <aside className="col-span-2 min-h-[calc(100vh-52px)] border-r border-slate-800 p-3">
          <div className="mb-3 text-lg font-semibold">AgentLens</div>
          <button
            className="mb-3 w-full rounded border border-slate-700 px-2 py-1 text-xs"
            onClick={() => {
              clearToken();
              setAuthTick((x) => x + 1);
            }}
          >
            Logout
          </button>
          <select className="mb-4 w-full rounded bg-slate-900 p-2 text-xs" value={agentId ?? ''} onChange={(e) => setSelectedAgent(e.target.value)}>
            {(me.data?.agents ?? []).map((a: any) => (
              <option key={a.agent_id} value={a.agent_id}>{a.display_name}</option>
            ))}
          </select>
          <nav className="space-y-1 text-sm">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`w-full rounded px-3 py-2 text-left ${tab === t ? 'bg-indigo-600' : 'hover:bg-slate-900'}`}
              >
                {t}
              </button>
            ))}
          </nav>
        </aside>
        <main className="col-span-10 space-y-4 p-4">
          <AgentConnect />
          {!status?.gateway_connected && (
            <div className="rounded border border-amber-700 bg-amber-950/40 px-4 py-2 text-sm text-amber-200">
              OpenClaw Gateway not found at ws://127.0.0.1:18789. Start OpenClaw first.
            </div>
          )}
          {tab === 'Timeline' && <Timeline initialEvents={events?.events ?? []} />}
          {tab === 'Tool Pulse' && <ToolPulse stats={toolStats} timeline={toolTimeline} />}
          {tab === 'Memory Guard' && <MemoryGuard files={memoryFiles} fileData={memoryFile} onSelect={setSelectedFile} />}
          {tab === 'Settings' && (
            <div className="space-y-2 text-sm text-slate-300">
              <h2 className="text-lg font-semibold text-slate-100">Settings</h2>
              <p>Configure AgentLens in <code>~/.agentlens/config.json</code>.</p>
              <p>Now supports email auth and agent-user linking for multi-agent visibility.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

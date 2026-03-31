import { useState } from 'react';
import { StatusBar } from './components/StatusBar';
import { Timeline } from './components/Timeline';
import { ToolPulse } from './components/ToolPulse';
import { MemoryGuard } from './components/MemoryGuard';
import { useEvents, useMemoryFile, useMemoryFiles, useStatus, useToolStats, useToolTimeline } from './hooks/useAgentData';

const tabs = ['Timeline', 'Tool Pulse', 'Memory Guard', 'Settings'] as const;

export default function App() {
  const [tab, setTab] = useState<(typeof tabs)[number]>('Timeline');
  const [selectedFile, setSelectedFile] = useState<string>();

  const status = useStatus().data;
  const events = useEvents().data;
  const toolStats = useToolStats().data;
  const toolTimeline = useToolTimeline().data;
  const memoryFiles = useMemoryFiles().data;
  const memoryFile = useMemoryFile(selectedFile).data;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <StatusBar status={status} />
      <div className="grid grid-cols-12">
        <aside className="col-span-2 min-h-[calc(100vh-52px)] border-r border-slate-800 p-3">
          <div className="mb-4 text-lg font-semibold">AgentLens</div>
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
        <main className="col-span-10 p-4">
          {!status?.gateway_connected && (
            <div className="mb-4 rounded border border-amber-700 bg-amber-950/40 px-4 py-2 text-sm text-amber-200">
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
              <p>Options: OpenClaw paths, Gateway URL, and refresh interval.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

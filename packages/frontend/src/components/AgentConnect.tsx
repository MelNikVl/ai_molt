import { useState } from 'react';
import { apiPost } from '../lib/api';

export function AgentConnect() {
  const [pairCode, setPairCode] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  const generatePairCode = async () => {
    const res = await apiPost<{ code: string; expires_at: number }>('/api/agents/pair-code', {});
    setPairCode(res.code);
    setExpiresAt(res.expires_at);
  };

  return (
    <div className="rounded border border-slate-800 bg-slate-900 p-4 text-sm">
      <h3 className="mb-2 font-semibold">Подключить агента</h3>
      <p className="mb-3 text-slate-300">Сгенерируйте код и передайте агенту команду подключения.</p>
      <button onClick={generatePairCode} className="rounded bg-indigo-600 px-3 py-2">Generate pair code</button>
      {pairCode && (
        <div className="mt-3 rounded bg-slate-950 p-3 font-mono text-xs">
          <div>PAIR_CODE={pairCode}</div>
          <div>EXPIRES_AT={expiresAt ? new Date(expiresAt).toISOString() : '-'}</div>
          <div className="mt-2 text-slate-400">Agent command example:</div>
          <div>curl -X POST http://localhost:47777/api/agents/connect -H 'Content-Type: application/json' -d '{{"pair_code":"{pairCode}","agent_id":"openclaw-main"}}'</div>
        </div>
      )}
    </div>
  );
}

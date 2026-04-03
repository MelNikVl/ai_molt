import { useState } from 'react';
import { format } from 'date-fns';
import { apiPost } from '../lib/api';

const badge = (severity: string) =>
  severity === 'high' ? '🔴' : severity === 'medium' ? '🟡' : '⚪';

export function MemoryGuard({ files, fileData, onSelect }: { files: any; fileData: any; onSelect: (p: string) => void }) {
  const [reason, setReason] = useState('reviewed');

  const markReviewed = async (snapshotId: number) => {
    await apiPost('/api/memory/flag', { snapshot_id: snapshotId, reason });
  };

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-4 rounded border border-slate-800">
        <h3 className="border-b border-slate-800 px-3 py-2 text-sm font-semibold">Memory Files</h3>
        <div className="max-h-[620px] overflow-y-auto">
          {(files?.files ?? []).map((file: any) => (
            <button
              key={file.file_path}
              onClick={() => onSelect(file.file_path)}
              className="flex w-full items-center justify-between border-b border-slate-900 px-3 py-2 text-left text-xs hover:bg-slate-900"
            >
              <span className="truncate">{file.file_path.split('/').slice(-2).join('/')}</span>
              <span className="text-slate-400">flags: {file.flag_count ?? 0}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="col-span-8 space-y-3">
        <div className="rounded border border-slate-800 p-3">
          <h3 className="mb-2 text-sm font-semibold">Content</h3>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs text-slate-300">{fileData?.content ?? 'Select a file'}</pre>
        </div>

        <div className="rounded border border-slate-800 p-3">
          <h3 className="mb-2 text-sm font-semibold">Flags</h3>
          <div className="space-y-2 text-xs">
            {(fileData?.flags ?? []).map((flag: any, idx: number) => (
              <div key={idx} className="rounded bg-slate-900 p-2">
                <div>{badge(flag.severity)} {flag.heuristic}</div>
                <div className="text-slate-400">{flag.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-slate-800 p-3">
          <h3 className="mb-2 text-sm font-semibold">Snapshot history</h3>
          <div className="space-y-1 text-xs">
            {(fileData?.snapshots ?? []).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between rounded bg-slate-900 px-2 py-1">
                <span>{format(s.captured_at, 'yyyy-MM-dd HH:mm:ss')}</span>
                <button onClick={() => markReviewed(s.id)} className="rounded bg-indigo-600 px-2 py-1">Mark as reviewed</button>
              </div>
            ))}
          </div>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-2 w-full rounded bg-slate-950 p-2 text-xs" />
        </div>
      </div>
    </div>
  );
}

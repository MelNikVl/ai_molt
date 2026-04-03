import { useEffect, useMemo, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { format } from 'date-fns';
import { getToken } from '../lib/api';

const colorFor = (type: string, success: number | null) => {
  if (type === 'heartbeat') return 'text-slate-400';
  if (type.includes('llm')) return 'text-sky-300';
  if (success === 1) return 'text-emerald-300';
  if (success === 0) return 'text-rose-300';
  return 'text-slate-200';
};

export function Timeline({ initialEvents }: { initialEvents: any[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filters, setFilters] = useState<Record<string, boolean>>({});

  useEffect(() => setEvents(initialEvents), [initialEvents]);

  useEffect(() => {
    const token = getToken();
    const source = new EventSource(`/api/stream?token=${encodeURIComponent(token ?? '')}`);
    source.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data);
        setEvents((prev) => [event, ...prev].slice(0, 2000));
      } catch {
        // ignore malformed payload
      }
    };
    return () => source.close();
  }, []);

  const types = useMemo(() => Array.from(new Set(events.map((e) => e.type))), [events]);
  const filtered = useMemo(
    () => events.filter((e) => (Object.values(filters).some(Boolean) ? filters[e.type] : true)),
    [events, filters]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Timeline</h2>
        <label className="text-sm text-slate-300">
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} className="mr-2" />
          Auto-scroll
        </label>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {types.map((type) => (
          <label key={type} className="rounded border border-slate-700 px-2 py-1">
            <input
              type="checkbox"
              checked={Boolean(filters[type])}
              onChange={(e) => setFilters((prev) => ({ ...prev, [type]: e.target.checked }))}
              className="mr-1"
            />
            {type}
          </label>
        ))}
      </div>
      <div className="rounded border border-slate-800">
        {filtered.length > 1000 ? (
          <List height={520} width={'100%'} itemCount={filtered.length} itemSize={36}>
            {({ index, style }) => {
              const event = filtered[index];
              return (
                <div style={style} className={`grid grid-cols-5 items-center border-b border-slate-900 px-3 text-xs ${colorFor(event.type, event.success)}`}>
                  <span>{format(event.timestamp, 'HH:mm:ss')}</span>
                  <span>{event.type}</span>
                  <span>{event.tool_name ?? '-'}</span>
                  <span>{event.duration_ms ?? '-'}</span>
                  <span>{event.success === 1 ? 'success' : event.success === 0 ? 'fail' : '-'}</span>
                </div>
              );
            }}
          </List>
        ) : (
          <div className="max-h-[520px] overflow-y-auto">
            {filtered.map((event, idx) => (
              <div key={idx} className={`grid grid-cols-5 items-center border-b border-slate-900 px-3 py-2 text-xs ${colorFor(event.type, event.success)}`}>
                <span>{format(event.timestamp, 'yyyy-MM-dd HH:mm:ss')}</span>
                <span>{event.type}</span>
                <span>{event.tool_name ?? '-'}</span>
                <span>{event.duration_ms ?? '-'}</span>
                <span>{event.success === 1 ? 'success' : event.success === 0 ? 'fail' : '-'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

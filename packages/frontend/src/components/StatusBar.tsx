import { formatDistanceToNowStrict } from 'date-fns';

export function StatusBar({ status }: { status: any }) {
  const last = status?.last_event_ts
    ? `${formatDistanceToNowStrict(status.last_event_ts, { addSuffix: true })}`
    : 'no events yet';

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${status?.gateway_connected ? 'bg-emerald-400' : 'bg-red-500'}`} />
        <span>{status?.gateway_connected ? 'Gateway connected' : 'Gateway disconnected'}</span>
      </div>
      <div className="flex items-center gap-4 text-slate-300">
        <span>Last event: {last}</span>
        <span>Session: {status?.active_session ?? 'n/a'}</span>
        <span>Events (24h): {status?.total_events_today ?? 0}</span>
      </div>
    </div>
  );
}

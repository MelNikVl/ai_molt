import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDistanceToNowStrict } from 'date-fns';

export function ToolPulse({ stats, timeline }: { stats: any; timeline: any }) {
  const top10 = (stats?.tools ?? []).slice(0, 10);
  const lineData = (timeline?.buckets ?? []).map((b: any) => ({ hour: b.hour.slice(11, 13), ...b.calls }));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Tool Pulse</h2>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="h-72 rounded border border-slate-800 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top10}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="tool_name" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="call_count" fill="#22d3ee" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="h-72 rounded border border-slate-800 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Legend />
              {top10.slice(0, 4).map((tool: any, idx: number) => (
                <Line key={tool.tool_name} type="monotone" dataKey={tool.tool_name} stroke={['#22d3ee', '#818cf8', '#f472b6', '#34d399'][idx]} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 text-slate-300">
            <tr>
              <th className="px-3 py-2">Tool</th>
              <th className="px-3 py-2">Calls</th>
              <th className="px-3 py-2">Success rate</th>
              <th className="px-3 py-2">Avg duration</th>
              <th className="px-3 py-2">Last used</th>
            </tr>
          </thead>
          <tbody>
            {top10.map((tool: any) => {
              const stale = !tool.last_used || Date.now() - tool.last_used > 24 * 3600 * 1000;
              const successRate = tool.call_count ? Math.round((tool.success_count / tool.call_count) * 100) : 0;
              return (
                <tr key={tool.tool_name} className={stale ? 'text-slate-500' : ''}>
                  <td className="px-3 py-2">{tool.tool_name}</td>
                  <td className="px-3 py-2">{tool.call_count}</td>
                  <td className="px-3 py-2">{successRate}%</td>
                  <td className="px-3 py-2">{Math.round(tool.total_duration_ms / Math.max(tool.call_count, 1))}ms</td>
                  <td className="px-3 py-2">{tool.last_used ? formatDistanceToNowStrict(tool.last_used, { addSuffix: true }) : 'never'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

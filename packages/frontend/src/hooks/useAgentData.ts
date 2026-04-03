import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';

const q = (agentId?: string) => (agentId ? `?agent_id=${encodeURIComponent(agentId)}` : '');

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => apiGet<any>('/api/auth/me') });

export const useStatus = (agentId?: string) =>
  useQuery({ queryKey: ['status', agentId], queryFn: () => apiGet<any>(`/api/status${q(agentId)}`), refetchInterval: 3000 });

export const useEvents = (agentId?: string, type?: string) =>
  useQuery({
    queryKey: ['events', agentId, type],
    queryFn: () => apiGet<any>(`/api/events?limit=300${agentId ? `&agent_id=${encodeURIComponent(agentId)}` : ''}${type ? `&type=${type}` : ''}`),
    refetchInterval: 5000
  });

export const useToolStats = (agentId?: string) =>
  useQuery({ queryKey: ['tools-stats', agentId], queryFn: () => apiGet<any>(`/api/tools/stats${q(agentId)}`), refetchInterval: 5000 });

export const useToolTimeline = (agentId?: string) =>
  useQuery({ queryKey: ['tools-timeline', agentId], queryFn: () => apiGet<any>(`/api/tools/timeline?hours=24${agentId ? `&agent_id=${encodeURIComponent(agentId)}` : ''}`), refetchInterval: 5000 });

export const useMemoryFiles = (agentId?: string) =>
  useQuery({ queryKey: ['memory-files', agentId], queryFn: () => apiGet<any>(`/api/memory/files${q(agentId)}`), refetchInterval: 8000 });

export const useMemoryFile = (filePath?: string, agentId?: string) =>
  useQuery({
    queryKey: ['memory-file', filePath, agentId],
    queryFn: () => apiGet<any>(`/api/memory/file?path=${encodeURIComponent(filePath ?? '')}${agentId ? `&agent_id=${encodeURIComponent(agentId)}` : ''}`),
    enabled: Boolean(filePath),
    refetchInterval: 8000
  });

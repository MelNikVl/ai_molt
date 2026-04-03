import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';

const q = (agentId?: string) => (agentId ? `?agent_id=${encodeURIComponent(agentId)}` : '');

export const useMe = (enabled: boolean) =>
  useQuery({ queryKey: ['me'], queryFn: () => apiGet<any>('/api/auth/me'), enabled });

export const useStatus = (agentId?: string, enabled = true) =>
  useQuery({ queryKey: ['status', agentId], queryFn: () => apiGet<any>(`/api/status${q(agentId)}`), refetchInterval: 3000, enabled });

export const useEvents = (agentId?: string, type?: string, enabled = true) =>
  useQuery({
    queryKey: ['events', agentId, type],
    queryFn: () => apiGet<any>(`/api/events?limit=300${agentId ? `&agent_id=${encodeURIComponent(agentId)}` : ''}${type ? `&type=${type}` : ''}`),
    refetchInterval: 5000,
    enabled
  });

export const useToolStats = (agentId?: string, enabled = true) =>
  useQuery({ queryKey: ['tools-stats', agentId], queryFn: () => apiGet<any>(`/api/tools/stats${q(agentId)}`), refetchInterval: 5000, enabled });

export const useToolTimeline = (agentId?: string, enabled = true) =>
  useQuery({
    queryKey: ['tools-timeline', agentId],
    queryFn: () => apiGet<any>(`/api/tools/timeline?hours=24${agentId ? `&agent_id=${encodeURIComponent(agentId)}` : ''}`),
    refetchInterval: 5000,
    enabled
  });

export const useMemoryFiles = (agentId?: string, enabled = true) =>
  useQuery({ queryKey: ['memory-files', agentId], queryFn: () => apiGet<any>(`/api/memory/files${q(agentId)}`), refetchInterval: 8000, enabled });

export const useMemoryFile = (filePath?: string, agentId?: string, enabled = true) =>
  useQuery({
    queryKey: ['memory-file', filePath, agentId],
    queryFn: () => apiGet<any>(`/api/memory/file?path=${encodeURIComponent(filePath ?? '')}${agentId ? `&agent_id=${encodeURIComponent(agentId)}` : ''}`),
    enabled: enabled && Boolean(filePath),
    refetchInterval: 8000
  });

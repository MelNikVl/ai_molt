import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api';

export const useStatus = () =>
  useQuery({ queryKey: ['status'], queryFn: () => apiGet<any>('/api/status'), refetchInterval: 3000 });

export const useEvents = (type?: string) =>
  useQuery({
    queryKey: ['events', type],
    queryFn: () => apiGet<any>(`/api/events?limit=300${type ? `&type=${type}` : ''}`),
    refetchInterval: 5000
  });

export const useToolStats = () =>
  useQuery({ queryKey: ['tools-stats'], queryFn: () => apiGet<any>('/api/tools/stats'), refetchInterval: 5000 });

export const useToolTimeline = () =>
  useQuery({ queryKey: ['tools-timeline'], queryFn: () => apiGet<any>('/api/tools/timeline?hours=24'), refetchInterval: 5000 });

export const useMemoryFiles = () =>
  useQuery({ queryKey: ['memory-files'], queryFn: () => apiGet<any>('/api/memory/files'), refetchInterval: 8000 });

export const useMemoryFile = (filePath?: string) =>
  useQuery({
    queryKey: ['memory-file', filePath],
    queryFn: () => apiGet<any>(`/api/memory/file?path=${encodeURIComponent(filePath ?? '')}`),
    enabled: Boolean(filePath),
    refetchInterval: 8000
  });

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface PointPrintSummary {
  last30d: number;
  today: number;
}

export interface PrintEventRow {
  id: string;
  point_id: string;
  doc_id: string;
  printed_at: string;
}

/**
 * Fetches printed card counts per point for the last 30 days and today.
 * Gracefully returns {} if the print_events table hasn't been created yet.
 */
export function usePrintSummary30d() {
  return useQuery({
    queryKey: ['print-summary-30d'],
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, PointPrintSummary>> => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayMs = todayStart.getTime();

      const { data, error } = await supabase
        .from('print_events')
        .select('point_id, printed_at')
        .gte('printed_at', since)
        .limit(50000);

      if (error) {
        // Table might not exist yet before SQL migration is applied
        return {};
      }

      const summary: Record<string, PointPrintSummary> = {};
      for (const row of data || []) {
        const pid = row.point_id as string;
        if (!summary[pid]) {
          summary[pid] = { last30d: 0, today: 0 };
        }
        summary[pid].last30d++;
        if (new Date(row.printed_at as string).getTime() >= todayMs) {
          summary[pid].today++;
        }
      }
      return summary;
    },
  });
}

/**
 * Fetches print events within an optional date range [fromIso, toIso] for the full report page.
 */
export function usePrintReport(fromIso?: string, toIso?: string) {
  return useQuery({
    queryKey: ['print-report', fromIso ?? 'all', toIso ?? 'all'],
    staleTime: 30_000,
    queryFn: async (): Promise<{ rows: PrintEventRow[]; tableMissing: boolean }> => {
      let query = supabase
        .from('print_events')
        .select('id, point_id, doc_id, printed_at')
        .order('printed_at', { ascending: false })
        .limit(100000);

      if (fromIso) query = query.gte('printed_at', fromIso);
      if (toIso) query = query.lte('printed_at', toIso);

      const { data, error } = await query;
      if (error) {
        if (error.code === '42P01' || error.message?.includes('print_events')) {
          return { rows: [], tableMissing: true };
        }
        throw error;
      }
      return { rows: (data || []) as PrintEventRow[], tableMissing: false };
    },
  });
}

/**
 * Fetches the latest visit timestamp per point across all visits (for 2-month / 60-day reminder).
 */
export function useLastVisitsByPoint() {
  return useQuery({
    queryKey: ['last-visits-by-point'],
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from('visits')
        .select('point_id, visited_at')
        .order('visited_at', { ascending: false })
        .limit(10000);

      if (error) return {};

      const map: Record<string, string> = {};
      for (const row of data || []) {
        const pid = row.point_id as string;
        if (!map[pid]) {
          map[pid] = row.visited_at as string;
        }
      }
      return map;
    },
  });
}

export const VISIT_OVERDUE_DAYS = 60;

export function getVisitAgeInfo(lastVisitedAt?: string | null) {
  if (!lastVisitedAt) {
    return { daysAgo: null as number | null, isOverdue: true, label: 'Не посещалась' };
  }
  const diffMs = Date.now() - new Date(lastVisitedAt).getTime();
  const daysAgo = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
  const isOverdue = daysAgo >= VISIT_OVERDUE_DAYS;
  const label = daysAgo === 0 ? 'Сегодня' : daysAgo === 1 ? 'Вчера' : `${daysAgo} дн. назад`;
  return { daysAgo, isOverdue, label };
}

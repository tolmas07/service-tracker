import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Point, PointStatus } from '../types';

export function usePoints() {
  return useQuery({
    queryKey: ['points'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('points')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Point[];
    },
  });
}

export function usePoint(id: string) {
  return useQuery({
    queryKey: ['points', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('points')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Point;
    },
    enabled: !!id,
  });
}

export function useCreatePoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (point: Omit<Point, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('points')
        .insert(point)
        .select()
        .single();
      if (error) throw error;
      return data as Point;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['points'] }),
  });
}

export function useUpdatePoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Point> & { id: string }) => {
      const { error } = await supabase
        .from('points')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['points'] }),
  });
}

export function useDeletePoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('points').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['points'] }),
  });
}

export function useUpdatePointStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PointStatus }) => {
      const { error } = await supabase
        .from('points')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['points'] }),
  });
}

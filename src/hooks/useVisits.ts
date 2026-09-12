import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { Visit, Photo } from '../types';

export function useVisits(pointId?: string) {
  const user = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: ['visits', pointId, user?.id],
    queryFn: async () => {
      let query = supabase
        .from('visits')
        .select('*, point:points(*)')
        .order('visited_at', { ascending: false });

      if (pointId) query = query.eq('point_id', pointId);
      if (user?.role === 'worker') {
        query = query.eq('worker_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Visit[];
    },
  });
}

export function useCreateVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (visit: Omit<Visit, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('visits')
        .insert(visit)
        .select()
        .single();
      if (error) throw error;
      return data as Visit;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['visits'] }),
  });
}

export function useUpdateVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Visit> & { id: string }) => {
      const { error } = await supabase
        .from('visits')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['visits'] }),
  });
}

export function useVisitPhotos(visitId: string) {
  return useQuery({
    queryKey: ['photos', visitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('visit_id', visitId)
        .order('created_at');
      if (error) throw error;
      return data as Photo[];
    },
    enabled: !!visitId,
  });
}

export function useUploadPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      visitId,
      file,
      caption,
      photoType,
    }: {
      visitId: string;
      file: File;
      caption?: string;
      photoType?: string;
    }) => {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `visits/${visitId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from('photos')
        .insert({
          visit_id: visitId,
          storage_path: path,
          caption,
          photo_type: photoType,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Photo;
    },
    onSuccess: (_, variables) =>
      queryClient.invalidateQueries({ queryKey: ['photos', variables.visitId] }),
  });
}

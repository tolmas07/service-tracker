import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useUpdateVisit } from '../../hooks/useVisits';
import { VisitForm } from './VisitForm';
import type { Visit } from '../../types';

export function EditVisitPage() {
  const { id } = useParams<{ id: string }>();
  const updateVisit = useUpdateVisit();

  const { data: visit, isLoading } = useQuery({
    queryKey: ['visit', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('visits')
        .select('*')
        .eq('id', id)
        .single();
      return data as Visit;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center text-gray-400">Загрузка...</div>;
  }

  if (!visit) {
    return <div className="flex-1 flex items-center justify-center text-gray-400">Отчёт не найден</div>;
  }

  const handleSave = async (data: Record<string, string | undefined>) => {
    await updateVisit.mutateAsync({
      id: data.id!,
      point_id: data.point_id,
      work_type: data.work_type,
      work_description: data.work_description,
      status_after: data.status_after as Visit['status_after'],
      notes: data.notes,
    });
  };

  return (
    <VisitForm
      pointId={visit.point_id}
      initialData={{
        id: visit.id,
        point_id: visit.point_id,
        work_type: visit.work_type,
        work_description: visit.work_description,
        status_after: visit.status_after,
        notes: visit.notes,
      }}
      onSave={handleSave}
    />
  );
}

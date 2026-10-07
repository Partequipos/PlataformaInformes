import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';

export function useActs(params?: { act_type?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['acts', params],
    queryFn: async () => {
      const res = await apiService.getActs(params);
      if (!res.success || !res.data) throw new Error(res.error || 'Error al cargar actas');
      return res.data;
    },
  });
}

export function useAct(id?: string) {
  return useQuery({
    queryKey: ['act', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await apiService.getAct(id as string);
      if (!res.success || !res.data) throw new Error(res.error || 'Error al cargar acta');
      return res.data;
    },
  });
}

export function useSaveAct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, formData }: { id?: string; formData: FormData }) => {
      const res = id
        ? await apiService.updateAct(id, formData)
        : await apiService.createAct(formData);
      if (!res.success || !res.data) throw new Error(res.error || 'Error al guardar acta');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acts'] });
    },
  });
}

export function useDeleteAct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiService.deleteAct(id);
      if (!res.success) throw new Error(res.error || 'Error al eliminar');
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acts'] });
    },
  });
}

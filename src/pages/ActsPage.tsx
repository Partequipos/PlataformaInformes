import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ClipboardList, Eye, Plus, Trash2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { DashboardLayout } from '../components/templates/DashboardLayout';
import { LoadingSpinner } from '../components/molecules/LoadingSpinner';
import { Button } from '../components/atoms/Button';
import { Select } from '../components/atoms/Select';
import { useAuth } from '../context/AuthContext';
import { useActs, useDeleteAct } from '../hooks/useActs';

export const ActsPage: React.FC = () => {
  const { state } = useAuth();
  const role = state.user?.role;
  const [actType, setActType] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { data, isLoading, error } = useActs({
    act_type: actType || undefined,
    page: 1,
    limit: 50,
  });
  const deleteMutation = useDeleteAct();

  if (role === 'viewer') {
    return <Navigate to="/dashboard" replace />;
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-96 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex min-h-96 flex-col items-center justify-center text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-red-500" />
          <p className="text-slate-700">No se pudieron cargar las actas.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">Actas de equipo</h1>
            <p className="text-sm text-slate-600">Entrada y salida — personal interno</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/acts/new?type=entry">
              <Button type="button">
                <Plus className="mr-2 h-4 w-4" /> Acta de Entrada
              </Button>
            </Link>
            <Link to="/acts/new?type=exit">
              <Button type="button" variant="outline">
                <Plus className="mr-2 h-4 w-4" /> Acta de Salida
              </Button>
            </Link>
          </div>
        </div>

        <div className="max-w-xs">
          <Select
            label="Filtrar tipo"
            value={actType}
            onChange={(e) => setActType(e.target.value)}
            options={[
              { value: '', label: 'Todas' },
              { value: 'entry', label: 'Entrada' },
              { value: 'exit', label: 'Salida' },
            ]}
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Lugar</th>
                <th className="px-4 py-3">Equipo</th>
                <th className="px-4 py-3">PIN / Código</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((act) => (
                <tr key={act.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-xs font-semibold text-brand-red">
                      <ClipboardList className="h-3.5 w-3.5" />
                      {act.act_type === 'entry' ? 'Entrada' : 'Salida'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{act.location}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {[act.brand, act.model_type].filter(Boolean).join(' ') || act.equipment_type || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {act.pin_serial || act.internal_code || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {act.act_date ? format(new Date(act.act_date), 'dd/MM/yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link to={`/acts/${act.id}/html`} target="_blank" rel="noreferrer">
                        <Button type="button" size="sm" variant="outline">
                          <Eye className="mr-1 h-3.5 w-3.5" /> HTML
                        </Button>
                      </Link>
                      <Link to={`/acts/${act.id}/edit`}>
                        <Button type="button" size="sm" variant="secondary">
                          Editar
                        </Button>
                      </Link>
                      {confirmId === act.id ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteMutation.mutate(act.id, { onSuccess: () => setConfirmId(null) })}
                          >
                            Confirmar
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmId(act.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(data?.items || []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No hay actas registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

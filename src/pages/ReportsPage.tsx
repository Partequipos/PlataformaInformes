import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useReports, useDeleteReport } from '../hooks/useReports';
import { DashboardLayout } from '../components/templates/DashboardLayout';
import { LoadingSpinner } from '../components/molecules/LoadingSpinner';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { Select } from '../components/atoms/Select';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, 
  FileText, 
  Edit, 
  Trash2,
  Eye,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ReportFilters, ReportStatus } from '../types';

export const ReportsPage: React.FC = () => {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [pendingClientName, setPendingClientName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  const { data: reportsData, isLoading, error } = useReports({ ...filters, page: currentPage, limit: pageSize });
  const deleteReportMutation = useDeleteReport();
  const { state: { user } } = useAuth();
  
  const isAdmin = user?.role === 'admin';

  const machineTypeOptions = [
    { value: '', label: 'All Machine Types' },
    { value: 'EXCAVATOR', label: 'Excavator' },
    { value: 'BULLDOZER', label: 'Bulldozer' },
    { value: 'LOADER', label: 'Loader' },
    { value: 'CRANE', label: 'Crane' },
    { value: 'COMPACTOR', label: 'Compactor' },
    { value: 'GRADER', label: 'Grader' },
  ];

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'REVIEWED', label: 'Reviewed' },
  ];

  const handleFilterChange = (key: keyof ReportFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
    if (key === 'clientName') setPendingClientName(value);
  };

  const handleSearch = () => {
    setFilters(prev => ({
      ...prev,
      clientName: pendingClientName || undefined,
    }));
  };

  const handleDeleteReport = async (id: string) => {
    try {
      await deleteReportMutation.mutateAsync(id);
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting report:', error);
    }
  };

  const clearFilters = () => {
    setFilters({});
    setPendingClientName('');
    setCurrentPage(1);
    setPageSize(20);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Error Loading Reports</h3>
            <p className="text-slate-600">Please try refreshing the page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const reports = reportsData?.data || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
            <p className="text-slate-600 mt-1">Manage all technical inspection reports</p>
          </div>
          <Link to="/reports/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Report
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <Input
              placeholder="Search client name..."
              value={pendingClientName}
              onChange={(e) => setPendingClientName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
            />
            <Select
              options={machineTypeOptions}
              value={filters.machineType || ''}
              onChange={(e) => handleFilterChange('machineType', e.target.value)}
              placeholder="Select machine type"
            />
            <Select
              options={statusOptions}
              value={filters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value as ReportStatus)}
              placeholder="Select status"
            />
            <Select
              options={[
                { value: '10', label: '10 per page' },
                { value: '20', label: '20 per page' },
                { value: '50', label: '50 per page' },
                { value: '100', label: '100 per page' }
              ]}
              value={pageSize.toString()}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              placeholder="Page size"
            />
          </div>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <Button type="button" variant="primary" onClick={handleSearch}>
              Buscar
            </Button>
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>

          {/* Reports Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl-grid-cols-3 gap-6">
            {reports.map((report) => (
              <div key={report.id} className="bg-slate-50 rounded-lg border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 mb-1">{report.client_name || 'No Client'}</h3>
                    <p className="text-sm text-slate-600">{report.machine_type || 'N/A'} - {report.model || 'N/A'}</p>
                    <p className="text-sm text-slate-500">S/N: {report.serial_number || 'N/A'}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ml-2 ${
                    report.general_status === 'CLOSED'
                      ? 'bg-red-100 text-red-700 border border-red-200'
                      : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                  }`}>
                    {report.general_status === 'CLOSED' ? 'CLOSED' : 'PENDING'}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-slate-600">
                    <span className="font-medium">Date:</span>
                    <span className="ml-2">{report.report_date ? format(new Date(report.report_date), 'MMM dd, yyyy') : 'No Date'}</span>
                  </div>
                  <div className="flex items-center text-sm text-slate-600">
                    <span className="font-medium">Components:</span>
                    <span className="ml-2">{report.components?.length || 0}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Link to={`/reports/${report.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                  </Link>
                  <Link to={`/reports/${report.id}/edit`}>
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </Link>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirm(report.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {reportsData && reportsData.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
              <div className="text-sm text-slate-600">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, reportsData.total)} of {reportsData.total} reports
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center space-x-1">
                  {(() => {
                    const totalPages = reportsData.totalPages;
                    const current = currentPage;
                    const pages = [];
                    
                    // Calcular rango de páginas a mostrar
                    let startPage = Math.max(1, current - 2);
                    let endPage = Math.min(totalPages, current + 2);
                    
                    // Ajustar si estamos cerca del inicio o final
                    if (endPage - startPage < 4) {
                      if (startPage === 1) {
                        endPage = Math.min(totalPages, startPage + 4);
                      } else {
                        startPage = Math.max(1, endPage - 4);
                      }
                    }
                    
                    // Generar números de página únicos
                    for (let i = startPage; i <= endPage; i++) {
                      pages.push(i);
                    }
                    
                    return pages.map(pageNum => (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "primary" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-10 h-8"
                      >
                        {pageNum}
                      </Button>
                    ));
                  })()}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(reportsData.totalPages, prev + 1))}
                  disabled={currentPage === reportsData.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {reports.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No reports found</h3>
              <p className="text-slate-600 mb-4">
                {Object.keys(filters).length > 0
                  ? 'Try adjusting your filters or create a new report.'
                  : 'Get started by creating your first report.'
                }
              </p>
              <Link to="/reports/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Report
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-500 mr-3" />
              <h3 className="text-lg font-semibold text-slate-900">Confirm Deletion</h3>
            </div>
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete this report? This action cannot be undone and will permanently remove the report and all associated data including images.
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDeleteReport(deleteConfirm)}
                disabled={deleteReportMutation.isPending}
              >
                {deleteReportMutation.isPending ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
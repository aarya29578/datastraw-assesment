import React, { useState, useEffect } from 'react';
import {
  Workflow,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Users,
  Power,
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/common/Badge';
import { SearchInput } from '../../../components/common/SearchInput';
import { EmptyState } from '../../../components/common/EmptyState';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { ProcessFormModal } from '../components/ProcessFormModal';
import { processService } from '../services/processService';
import { brandService } from '../../brands/services/brandService';
import { assignmentService } from '../../assignments/services/assignmentService';
import { useToast } from '../../../components/common/Toast';
import { formatErrorMessage } from '../../../utils/errorHandler';

export function ProcessesPage() {
  const { addToast } = useToast();
  const [processes, setProcesses] = useState([]);
  const [brands, setBrands] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedProcessForEdit, setSelectedProcessForEdit] = useState(null);
  const [isConfirmToggleOpen, setIsConfirmToggleOpen] = useState(false);
  const [processToToggle, setProcessToToggle] = useState(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [processToDelete, setProcessToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [procList, brandList, asgnList] = await Promise.all([
        processService.getProcesses(),
        brandService.getBrands(),
        assignmentService.getAssignments(),
      ]);
      setProcesses(procList);
      setBrands(brandList);
      setAssignments(asgnList);
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to load operational processes'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateOrUpdateProcess = async (formData) => {
    try {
      setActionLoading(true);
      if (selectedProcessForEdit) {
        await processService.updateProcess(selectedProcessForEdit.id, formData);
        addToast(`Updated process ${formData.code}`, 'success');
      } else {
        await processService.createProcess(formData);
        addToast(`Created process ${formData.code}`, 'success');
      }
      setIsFormModalOpen(false);
      setSelectedProcessForEdit(null);
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Error saving process'), 'error');
      throw e;
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmToggleProcess = async () => {
    if (!processToToggle) return;
    try {
      setActionLoading(true);
      await processService.toggleProcessStatus(processToToggle.id);
      const newStatus = processToToggle.status === 'ACTIVE' ? 'deactivated' : 'activated';
      addToast(`Process ${processToToggle.code} ${newStatus}`, 'success');
      setIsConfirmToggleOpen(false);
      setProcessToToggle(null);
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to change process status'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteProcess = async () => {
    if (!processToDelete) return;
    try {
      setActionLoading(true);
      await processService.deleteProcessPermanently(processToDelete.id);
      addToast(`Process ${processToDelete.name} permanently deleted`, 'success');
      setIsDeleteConfirmOpen(false);
      setProcessToDelete(null);
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to delete process'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const activeCount = processes.filter((p) => p.status === 'ACTIVE').length;
  const inactiveCount = processes.filter((p) => p.status === 'INACTIVE').length;

  const filteredProcesses = processes.filter((proc) => {
    const matchesSearch =
      proc.name.toLowerCase().includes(search.toLowerCase()) ||
      proc.code.toLowerCase().includes(search.toLowerCase()) ||
      (proc.description || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'ACTIVE'
        ? proc.status === 'ACTIVE'
        : proc.status === 'INACTIVE';

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Processes"
        subtitle="Core workflow types including Customer Support, Cart Recovery, Retention, and NDR"
        badge={<Badge variant="primary">{processes.length} Processes</Badge>}
      >
        <Button
          icon={Plus}
          onClick={() => {
            setSelectedProcessForEdit(null);
            setIsFormModalOpen(true);
          }}
        >
          Add Process
        </Button>
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search processes by name, code..."
          />
        </div>

        <div className="flex items-center gap-1.5 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              statusFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({processes.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('INACTIVE')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              statusFilter === 'INACTIVE'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Inactive ({inactiveCount})
          </button>
          {(search || statusFilter !== 'ALL') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Grid of Processes */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs">
          Loading operational processes...
        </div>
      ) : filteredProcesses.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No processes found"
          description="No processes match your active search or status filters."
          actionLabel="Reset Filters"
          onAction={() => {
            setSearch('');
            setStatusFilter('ALL');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredProcesses.map((proc) => {
            // Count brands that have this process
            const assignedBrands = brands.filter((b) => b.assignedProcesses.includes(proc.id));
            // Count staff mapped to this process
            const assignedStaff = assignments.filter((a) => a.processIds.includes(proc.id));

            return (
              <div
                key={proc.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-sm flex items-center justify-center">
                        {proc.code}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{proc.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant={proc.status === 'ACTIVE' ? 'success' : 'danger'} dot size="sm">
                            {proc.status}
                          </Badge>
                          <span className="text-[11px] text-slate-400">
                            Min Staffing: <strong>{proc.defaultMinStaff}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProcessForEdit(proc);
                          setIsFormModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                        title="Edit Process"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProcessToToggle(proc);
                          setIsConfirmToggleOpen(true);
                        }}
                        className={`p-1.5 rounded-lg ${
                          proc.status === 'ACTIVE'
                            ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                            : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={proc.status === 'ACTIVE' ? 'Deactivate Process' : 'Activate Process'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProcessToDelete(proc);
                          setIsDeleteConfirmOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Delete Process Permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                    {proc.description}
                  </p>

                  {/* Metrics */}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-2.5">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-xs font-bold text-slate-900">{assignedBrands.length}</p>
                        <p className="text-[10px] text-slate-500">Active Brands</p>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-xs font-bold text-slate-900">{assignedStaff.length}</p>
                        <p className="text-[10px] text-slate-500">Staff Allocations</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Brands list preview */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Sample Client Brands:
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {assignedBrands.slice(0, 5).map((b) => (
                      <span
                        key={b.id}
                        className="px-2 py-0.5 text-[10px] rounded bg-slate-100 text-slate-700 font-medium"
                      >
                        {b.name}
                      </span>
                    ))}
                    {assignedBrands.length > 5 && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        +{assignedBrands.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      <ProcessFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedProcessForEdit(null);
        }}
        onSubmit={handleCreateOrUpdateProcess}
        process={selectedProcessForEdit}
        loading={actionLoading}
      />

      {/* Confirm Status Toggle */}
      <ConfirmDialog
        isOpen={isConfirmToggleOpen}
        onClose={() => {
          setIsConfirmToggleOpen(false);
          setProcessToToggle(null);
        }}
        onConfirm={handleConfirmToggleProcess}
        title={
          processToToggle?.status === 'ACTIVE'
            ? 'Deactivate Process'
            : 'Activate Process'
        }
        message={
          processToToggle?.status === 'ACTIVE'
            ? `Are you sure you want to deactivate ${processToToggle?.name} (${processToToggle?.code})? Inactive processes will not be available in active selection dropdowns.`
            : `Are you sure you want to reactivate ${processToToggle?.name} (${processToToggle?.code})?`
        }
        type={processToToggle?.status === 'ACTIVE' ? 'danger' : 'info'}
        confirmText={
          processToToggle?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'
        }
        loading={actionLoading}
      />

      {/* Confirm Permanent Delete */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setProcessToDelete(null);
        }}
        onConfirm={handleDeleteProcess}
        title="Permanently Delete Process"
        message={
          processToDelete
            ? `Are you sure you want to permanently delete process '${processToDelete.name}' (${processToDelete.code})? This will permanently remove it from the database if no dependent employee assignments or working rules exist.`
            : ''
        }
        type="danger"
        confirmText="Permanently Delete"
        loading={actionLoading}
      />
    </div>
  );
}

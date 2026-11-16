import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  Building2,
  Users,
  Workflow,
  Edit2,
  Trash2,
  CheckCircle2,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/common/Badge';
import { SearchInput } from '../../../components/common/SearchInput';
import { Select } from '../../../components/ui/Select';
import { EmptyState } from '../../../components/common/EmptyState';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { AssignmentFormModal } from '../components/AssignmentFormModal';
import { assignmentService } from '../services/assignmentService';
import { employeeService } from '../../employees/services/employeeService';
import { brandService } from '../../brands/services/brandService';
import { processService } from '../../processes/services/processService';
import { useToast } from '../../../components/common/Toast';
import { formatErrorMessage } from '../../../utils/errorHandler';

export function AssignmentsPage() {
  const { addToast } = useToast();
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [brands, setBrands] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [processFilter, setProcessFilter] = useState('');
  const [activeTab, setActiveTab] = useState('TABLE'); // 'TABLE' or 'BRAND_MATRIX'

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedAssignmentForEdit, setSelectedAssignmentForEdit] = useState(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [asgnList, empList, brandList, procList] = await Promise.all([
        assignmentService.getAssignments(),
        employeeService.getEmployees(),
        brandService.getBrands(),
        processService.getProcesses(),
      ]);
      setAssignments(asgnList);
      setEmployees(empList);
      setBrands(brandList);
      setProcesses(procList);
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to load assignments'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredAssignments = assignments.filter((asgn) => {
    const emp = employees.find((e) => e.id === asgn.employeeId);
    const brand = brands.find((b) => b.id === asgn.brandId);

    const matchesSearch =
      (emp?.fullName.toLowerCase().includes(search.toLowerCase()) || false) ||
      (brand?.name.toLowerCase().includes(search.toLowerCase()) || false) ||
      (asgn.notes?.toLowerCase().includes(search.toLowerCase()) || false);

    const matchesBrand = brandFilter ? asgn.brandId === brandFilter : true;
    const matchesProcess = processFilter ? (asgn.processIds || []).includes(processFilter) : true;

    return matchesSearch && matchesBrand && matchesProcess;
  });

  const handleCreateOrUpdateAssignment = async (formData) => {
    try {
      setActionLoading(true);
      if (selectedAssignmentForEdit) {
        await assignmentService.updateAssignment(selectedAssignmentForEdit.id, formData);
        addToast('Assignment successfully updated', 'success');
      } else {
        await assignmentService.createAssignment(formData);
        addToast('New assignment mapping created', 'success');
      }
      setIsFormModalOpen(false);
      setSelectedAssignmentForEdit(null);
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, selectedAssignmentForEdit ? 'Failed to update assignment' : 'Failed to create assignment'), 'error');
      throw e;
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAssignment = async () => {
    if (!assignmentToDelete) return;
    try {
      setActionLoading(true);
      await assignmentService.deleteAssignment(assignmentToDelete.id);
      addToast('Assignment removed', 'success');
      setIsDeleteConfirmOpen(false);
      setAssignmentToDelete(null);
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to delete assignment'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Brand & Process Assignments"
        subtitle="Manage cross-brand mappings, process responsibilities, and dedicated staff allocations"
        badge={<Badge variant="primary">{assignments.length} Mappings</Badge>}
      >
        <Button
          icon={Plus}
          onClick={() => {
            setSelectedAssignmentForEdit(null);
            setIsFormModalOpen(true);
          }}
        >
          Assign Employee
        </Button>
      </PageHeader>

      {/* Overview Cards highlighting Key Architecture Rules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>Dedicated Single-Staff (~80%)</span>
          </div>
          <p className="text-xs text-slate-600">
            Dedicated specialist assigned as primary lead across all core brand queues.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>Multi-Person Staffed</span>
          </div>
          <p className="text-xs text-slate-600">
            Multiple dedicated specialists allocated to distinct operational queues.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 text-purple-600 text-xs font-bold uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4" />
            <span>Cross-Brand Sharing</span>
          </div>
          <p className="text-xs text-slate-600">
            Cross-trained specialist managing queues across multiple client brand accounts.
          </p>
        </div>
      </div>

      {/* Filter & View Switcher */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by employee or brand..."
          />
        </div>

        <div className="w-full md:w-auto flex items-center gap-3">
          <div className="w-full sm:w-48">
            <Select
              placeholder="All Brands"
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              options={[
                { value: '', label: 'All Client Brands' },
                ...brands.map((b) => ({ value: b.id, label: b.name })),
              ]}
            />
          </div>

          <div className="w-full sm:w-52">
            <Select
              placeholder="All Processes"
              value={processFilter}
              onChange={(e) => setProcessFilter(e.target.value)}
              options={[
                { value: '', label: 'All Processes' },
                ...processes.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` })),
              ]}
            />
          </div>

          {(search || brandFilter || processFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setBrandFilter('');
                setProcessFilter('');
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Assignments Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            Loading assignment matrices...
          </div>
        ) : filteredAssignments.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No assignments match your search"
            description="Adjust your search or add a new employee assignment."
            actionLabel="Reset Filters"
            onAction={() => {
              setSearch('');
              setBrandFilter('');
              setProcessFilter('');
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Assigned Brand</th>
                  <th className="py-3 px-4">Mapped Processes</th>
                  <th className="py-3 px-4">Role / Priority</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredAssignments.map((asgn) => {
                  const emp = employees.find((e) => e.id === asgn.employeeId);
                  const brand = brands.find((b) => b.id === asgn.brandId);

                  return (
                    <tr key={asgn.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Employee */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {emp ? emp.avatar : 'EM'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {emp ? emp.fullName : 'Unknown'}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {emp?.employeeId} • {emp?.designation}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Brand */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-800">
                            {brand ? brand.name : asgn.brandId}
                          </span>
                        </div>
                      </td>

                      {/* Processes */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(asgn.processIds || []).map((pid) => {
                            const proc = processes.find((p) => p.id === pid);
                            return (
                              <span
                                key={pid}
                                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 inline-flex items-center gap-1"
                              >
                                <span>{proc?.name || pid}</span>
                                {proc?.code && (
                                  <span className="text-[10px] text-indigo-400 font-mono">
                                    ({proc.code})
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* Role Priority */}
                      <td className="py-3.5 px-4">
                        {asgn.isPrimary ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Primary Lead
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                            Support / Backup
                          </span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                        {asgn.notes || '-'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAssignmentForEdit(asgn);
                              setIsFormModalOpen(true);
                            }}
                            className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Edit Assignment"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAssignmentToDelete(asgn);
                              setIsDeleteConfirmOpen(true);
                            }}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Remove Assignment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <AssignmentFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedAssignmentForEdit(null);
        }}
        onSubmit={handleCreateOrUpdateAssignment}
        assignment={selectedAssignmentForEdit}
        employees={employees}
        brands={brands}
        processes={processes}
        loading={actionLoading}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setAssignmentToDelete(null);
        }}
        onConfirm={handleDeleteAssignment}
        title="Remove Staff Assignment"
        message="Are you sure you want to remove this assignment mapping? The employee will no longer be scheduled for this brand/process combination."
        type="danger"
        confirmText="Remove"
        loading={actionLoading}
      />
    </div>
  );
}

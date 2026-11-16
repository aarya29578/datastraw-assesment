import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  UserX,
  UserCheck,
  Building,
  Layers,
  Calendar,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/common/Badge';
import { SearchInput } from '../../../components/common/SearchInput';
import { Select } from '../../../components/ui/Select';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { EmptyState } from '../../../components/common/EmptyState';
import { EmployeeFormModal } from '../components/EmployeeFormModal';
import { EmployeeDetailsModal } from '../components/EmployeeDetailsModal';
import { DeleteEmployeeModal } from '../components/DeleteEmployeeModal';
import { employeeService } from '../services/employeeService';
import { podService } from '../../pods/services/podService';
import { brandService } from '../../brands/services/brandService';
import { processService } from '../../processes/services/processService';
import { assignmentService } from '../../assignments/services/assignmentService';
import { useToast } from '../../../components/common/Toast';
import { formatErrorMessage } from '../../../utils/errorHandler';
import { formatReadableDate } from '../../../utils/dateUtils';

export function EmployeesPage() {
  const { addToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [pods, setPods] = useState([]);
  const [brands, setBrands] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPodFilter, setSelectedPodFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedEmployeeForView, setSelectedEmployeeForView] = useState(null);
  const [isConfirmDeactivateOpen, setIsConfirmDeactivateOpen] = useState(false);
  const [employeeToDeactivate, setEmployeeToDeactivate] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [deletionEligibility, setDeletionEligibility] = useState(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [empList, podList, brandList, procList, asgnList] = await Promise.all([
        employeeService.getEmployees(),
        podService.getPods(),
        brandService.getBrands(),
        processService.getProcesses(),
        assignmentService.getAssignments(),
      ]);
      setEmployees(empList);
      setPods(podList);
      setBrands(brandList);
      setProcesses(procList);
      setAssignments(asgnList);
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to load employee directory'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter logic
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.designation.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPod = selectedPodFilter ? emp.podId === selectedPodFilter : true;
    const matchesStatus = selectedStatusFilter ? emp.status === selectedStatusFilter : true;

    return matchesSearch && matchesPod && matchesStatus;
  });

  const handleCreateOrUpdateEmployee = async (formData) => {
    try {
      setActionLoading(true);
      if (selectedEmployeeForEdit) {
        await employeeService.updateEmployee(selectedEmployeeForEdit.id, formData);
        addToast(`Updated details for ${formData.fullName}`, 'success');
      } else {
        await employeeService.createEmployee(formData);
        addToast(`Added ${formData.fullName} to the directory`, 'success');
      }
      setIsFormModalOpen(false);
      setSelectedEmployeeForEdit(null);
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Error saving employee'), 'error');
      throw e; // rethrow to keep modal open with field-level errors
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmToggleStatus = async () => {
    if (!employeeToDeactivate) return;
    try {
      setActionLoading(true);
      await employeeService.toggleEmployeeStatus(employeeToDeactivate.id);
      const newStatus = employeeToDeactivate.status === 'ACTIVE' ? 'deactivated' : 'activated';
      addToast(`Employee successfully ${newStatus}`, 'success');
      setIsConfirmDeactivateOpen(false);
      setEmployeeToDeactivate(null);
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to update employee status'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleInitiateDelete = async (emp) => {
    setEmployeeToDelete(emp);
    setDeletionEligibility(null);
    setIsDeleteModalOpen(true);
    setEligibilityLoading(true);
    try {
      const eligibility = await employeeService.checkDeletionEligibility(emp.id);
      setDeletionEligibility(eligibility);
    } catch (err) {
      console.error(err);
      addToast(formatErrorMessage(err, 'Failed to check deletion eligibility'), 'error');
    } finally {
      setEligibilityLoading(false);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!employeeToDelete) return;
    try {
      setActionLoading(true);
      await employeeService.deleteEmployee(employeeToDelete.id, true);
      addToast(`Employee ${employeeToDelete.fullName} permanently deleted`, 'success');
      setIsDeleteModalOpen(false);
      setEmployeeToDelete(null);
      setDeletionEligibility(null);
      setIsDetailsModalOpen(false);
      setSelectedEmployeeForView(null);
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to permanently delete employee'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivateFromModal = async () => {
    if (!employeeToDelete) return;
    try {
      setActionLoading(true);
      await employeeService.toggleEmployeeStatus(employeeToDelete.id);
      addToast(
        `Employee ${employeeToDelete.fullName} deactivated successfully. Historical rosters preserved.`,
        'success'
      );
      setIsDeleteModalOpen(false);
      setEmployeeToDelete(null);
      setDeletionEligibility(null);
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to deactivate employee'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnassignFromModal = async () => {
    if (!employeeToDelete) return;
    try {
      setActionLoading(true);
      await employeeService.updateEmployee(employeeToDelete.id, { podId: '' });
      addToast(`Employee ${employeeToDelete.fullName} is now Unassigned (No Pod).`, 'success');
      setIsDeleteModalOpen(false);
      setEmployeeToDelete(null);
      setDeletionEligibility(null);
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to unassign employee'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Management"
        subtitle={`Total workforce headcount: ${employees.length} team members`}
        badge={
          <Badge variant="primary">
            {employees.filter((e) => e.status === 'ACTIVE').length} Active
          </Badge>
        }
      >
        <Button
          icon={Plus}
          onClick={() => {
            setSelectedEmployeeForEdit(null);
            setIsFormModalOpen(true);
          }}
        >
          Add Employee
        </Button>
      </PageHeader>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by name, ID, email..."
          />
        </div>

        <div className="w-full md:w-auto flex items-center gap-3">
          <div className="w-full sm:w-48">
            <Select
              placeholder="All Pods"
              value={selectedPodFilter}
              onChange={(e) => setSelectedPodFilter(e.target.value)}
              options={[
                { value: '', label: 'All Operational Pods' },
                ...pods.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </div>

          <div className="w-full sm:w-40">
            <Select
              placeholder="All Statuses"
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
            />
          </div>

          {(searchQuery || selectedPodFilter || selectedStatusFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedPodFilter('');
                setSelectedStatusFilter('');
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Employee Directory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs font-medium">
            Loading employee directory...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No employees match your criteria"
            description="Try adjusting your search terms or clearing your pod/status filters."
            actionLabel="Clear Filters"
            onAction={() => {
              setSearchQuery('');
              setSelectedPodFilter('');
              setSelectedStatusFilter('');
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Pod</th>
                  <th className="py-3 px-4">Weekly Off</th>
                  <th className="py-3 px-4">Assignments</th>
                  <th className="py-3 px-4">Joining Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredEmployees.map((emp) => {
                  const pod = pods.find((p) => p.id === emp.podId) || emp.pod;
                  const empAsgns = assignments.filter((a) => a.employeeId === emp.id);

                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${
                        emp.status !== 'ACTIVE' ? 'bg-slate-50/60 opacity-80' : ''
                      }`}
                      onClick={() => {
                        setSelectedEmployeeForView(emp);
                        setIsDetailsModalOpen(true);
                      }}
                    >
                      {/* Name & ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                            {emp.avatar || 'EM'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {emp.fullName}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {emp.employeeId} • {emp.designation}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Pod */}
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-700">
                          {pod?.name || emp.pod?.name || 'Unassigned'}
                        </span>
                      </td>

                      {/* Weekly Off */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                          {emp.weeklyOff}
                        </span>
                      </td>

                      {/* Assignments preview */}
                      <td className="py-3.5 px-4">
                        {empAsgns.length > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {empAsgns.map((a) => {
                              const b = brands.find((br) => br.id === a.brandId);
                              return (
                                <span
                                  key={a.id}
                                  className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium text-[11px]"
                                >
                                  {b ? b.name : a.brandId}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">None</span>
                        )}
                      </td>

                      {/* Joining date */}
                      <td className="py-3.5 px-4 text-slate-500">
                        {formatReadableDate(emp.joiningDate)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={emp.status === 'ACTIVE' ? 'success' : 'danger'}
                          dot
                          size="sm"
                        >
                          {emp.status}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3.5 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            title="View Profile"
                            onClick={() => {
                              setSelectedEmployeeForView(emp);
                              setIsDetailsModalOpen(true);
                            }}
                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Edit Employee"
                            onClick={() => {
                              setSelectedEmployeeForEdit(emp);
                              setIsFormModalOpen(true);
                            }}
                            className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title={emp.status === 'ACTIVE' ? 'Deactivate Employee' : 'Activate Employee'}
                            onClick={() => {
                              setEmployeeToDeactivate(emp);
                              setIsConfirmDeactivateOpen(true);
                            }}
                            className={`p-1.5 rounded-md ${
                              emp.status === 'ACTIVE'
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {emp.status === 'ACTIVE' ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Delete Employee"
                            onClick={() => handleInitiateDelete(emp)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
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

      {/* Employee Add/Edit Modal */}
      <EmployeeFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedEmployeeForEdit(null);
        }}
        onSubmit={handleCreateOrUpdateEmployee}
        employee={selectedEmployeeForEdit}
        pods={pods}
        loading={actionLoading}
      />

      {/* Employee Details Modal */}
      <EmployeeDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedEmployeeForView(null);
        }}
        employee={selectedEmployeeForView}
        pod={pods.find((p) => p.id === selectedEmployeeForView?.podId)}
        assignments={assignments}
        brands={brands}
        processes={processes}
        onEdit={() => {
          setIsDetailsModalOpen(false);
          setSelectedEmployeeForEdit(selectedEmployeeForView);
          setIsFormModalOpen(true);
        }}
        onToggleStatus={() => {
          setIsDetailsModalOpen(false);
          setEmployeeToDeactivate(selectedEmployeeForView);
          setIsConfirmDeactivateOpen(true);
        }}
        onDelete={() => {
          setIsDetailsModalOpen(false);
          handleInitiateDelete(selectedEmployeeForView);
        }}
      />

      {/* Confirmation Dialog for Status Change */}
      <ConfirmDialog
        isOpen={isConfirmDeactivateOpen}
        onClose={() => {
          setIsConfirmDeactivateOpen(false);
          setEmployeeToDeactivate(null);
        }}
        onConfirm={handleConfirmToggleStatus}
        title={
          employeeToDeactivate?.status === 'ACTIVE'
            ? 'Deactivate Employee'
            : 'Reactivate Employee'
        }
        message={
          employeeToDeactivate?.status === 'ACTIVE'
            ? `Are you sure you want to deactivate ${employeeToDeactivate?.fullName}? They will be marked unavailable for upcoming roster generations.`
            : `Are you sure you want to reactivate ${employeeToDeactivate?.fullName}?`
        }
        type={employeeToDeactivate?.status === 'ACTIVE' ? 'warning' : 'info'}
        confirmText={
          employeeToDeactivate?.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'
        }
        loading={actionLoading}
      />

      {/* Intelligent Delete Employee Modal with Historical Reference Protection */}
      <DeleteEmployeeModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setEmployeeToDelete(null);
          setDeletionEligibility(null);
        }}
        employee={employeeToDelete}
        eligibility={deletionEligibility}
        eligibilityLoading={eligibilityLoading}
        onConfirmPermanentDelete={handleConfirmPermanentDelete}
        onDeactivate={handleDeactivateFromModal}
        onUnassign={handleUnassignFromModal}
        actionLoading={actionLoading}
      />
    </div>
  );
}

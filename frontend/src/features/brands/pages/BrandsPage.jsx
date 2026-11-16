import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  Users,
  Workflow,
  Clock,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/common/Badge';
import { SearchInput } from '../../../components/common/SearchInput';
import { Select } from '../../../components/ui/Select';
import { EmptyState } from '../../../components/common/EmptyState';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { BrandFormModal } from '../components/BrandFormModal';
import { BrandDetailsModal } from '../components/BrandDetailsModal';
import { brandService } from '../services/brandService';
import { podService } from '../../pods/services/podService';
import { processService } from '../../processes/services/processService';
import { employeeService } from '../../employees/services/employeeService';
import { assignmentService } from '../../assignments/services/assignmentService';
import { useToast } from '../../../components/common/Toast';
import { formatErrorMessage } from '../../../utils/errorHandler';

export function BrandsPage() {
  const { addToast } = useToast();
  const [brands, setBrands] = useState([]);
  const [pods, setPods] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [podFilter, setPodFilter] = useState('');
  const [staffingFilter, setStaffingFilter] = useState('');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedBrandForEdit, setSelectedBrandForEdit] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedBrandForView, setSelectedBrandForView] = useState(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [brandToDelete, setBrandToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [brandList, podList, procList, empList, asgnList] = await Promise.all([
        brandService.getBrands(),
        podService.getPods(),
        processService.getProcesses(),
        employeeService.getEmployees(),
        assignmentService.getAssignments(),
      ]);
      setBrands(brandList);
      setPods(podList);
      setProcesses(procList);
      setEmployees(empList);
      setAssignments(asgnList);
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to load brands directory'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredBrands = brands.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.brandId.toLowerCase().includes(search.toLowerCase()) ||
      b.description.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'ACTIVE'
        ? (b.status === 'ACTIVE' || !b.status)
        : b.status === 'INACTIVE';

    const matchesPod = podFilter
      ? (b.pods || []).some((p) => p.id === podFilter) || b.podId === podFilter
      : true;
    const matchesStaffing =
      staffingFilter === 'SINGLE'
        ? b.isSingleDedicatedStaff
        : staffingFilter === 'MULTI'
        ? !b.isSingleDedicatedStaff
        : true;

    return matchesSearch && matchesStatus && matchesPod && matchesStaffing;
  });

  const activeCount = brands.filter((b) => b.status === 'ACTIVE' || !b.status).length;
  const inactiveCount = brands.filter((b) => b.status === 'INACTIVE').length;

  const handleCreateOrUpdateBrand = async (formData) => {
    try {
      setActionLoading(true);
      if (selectedBrandForEdit) {
        await brandService.updateBrand(selectedBrandForEdit.id, formData);
        addToast(`Updated brand ${formData.name}`, 'success');
      } else {
        await brandService.createBrand(formData);
        addToast(`Created brand ${formData.name}`, 'success');
      }
      setIsFormModalOpen(false);
      setSelectedBrandForEdit(null);
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Error saving brand'), 'error');
      throw e;
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBrand = async () => {
    if (!brandToDelete) return;
    try {
      setActionLoading(true);
      const res = await brandService.deleteBrand(brandToDelete.id, { permanent: true });
      const msg = `Brand '${brandToDelete.name}' permanently deleted`;
      addToast(msg, 'success');
      setIsDeleteConfirmOpen(false);
      setBrandToDelete(null);
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Error deleting brand'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brand Portfolio Management"
        subtitle={`Total client accounts: ${brands.length} partner brands across India`}
        badge={<Badge variant="primary">{brands.length} Brands</Badge>}
      >
        <Button
          icon={Plus}
          onClick={() => {
            setSelectedBrandForEdit(null);
            setIsFormModalOpen(true);
          }}
        >
          Add Brand
        </Button>
      </PageHeader>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-72">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search brands by name, ID..."
          />
        </div>

        <div className="w-full md:w-auto flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({brands.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
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
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                statusFilter === 'INACTIVE'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Inactive ({inactiveCount})
            </button>
          </div>

          <div className="w-full sm:w-44">
            <Select
              placeholder="All Pods"
              value={podFilter}
              onChange={(e) => setPodFilter(e.target.value)}
              options={[
                { value: '', label: 'All Operational Pods' },
                ...pods.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
          </div>

          <div className="w-full sm:w-44">
            <Select
              placeholder="Staffing Model"
              value={staffingFilter}
              onChange={(e) => setStaffingFilter(e.target.value)}
              options={[
                { value: '', label: 'All Staffing Models' },
                { value: 'SINGLE', label: 'Single Dedicated Staff (~80%)' },
                { value: 'MULTI', label: 'Multi-Staffed' },
              ]}
            />
          </div>

          {(search || podFilter || staffingFilter || statusFilter !== 'ALL') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setPodFilter('');
                setStaffingFilter('');
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Brands Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400 text-xs">
            Loading brands portfolio...
          </div>
        ) : filteredBrands.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={Building2}
              title="No brands found"
              description="No brands match your active filters or search terms."
              actionLabel="Reset Filters"
              onAction={() => {
                setSearch('');
                setPodFilter('');
                setStaffingFilter('');
              }}
            />
          </div>
        ) : (
          filteredBrands.map((brand) => {
            const pod = pods.find((p) => p.id === brand.podId);
            const brandAsgns = assignments.filter((a) => a.brandId === brand.id);
            const brandProcs = processes.filter((p) => brand.assignedProcesses.includes(p.id));

            return (
              <div
                key={brand.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {brand.brandId}
                        </span>
                        <Badge
                          variant={brand.status === 'INACTIVE' ? 'danger' : 'success'}
                          dot
                          size="sm"
                        >
                          {brand.status || 'ACTIVE'}
                        </Badge>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-2">{brand.name}</h3>
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {brand.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBrandForEdit(brand);
                          setIsFormModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        title="Edit Brand"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBrandToDelete(brand);
                          setIsDeleteConfirmOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Delete Brand"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Badges: Pod & Staffing Mode */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {brand.pods && brand.pods.length > 0 ? (
                      brand.pods.map((p) => (
                        <Badge key={p.id} variant="default" size="sm">
                          {p.name}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="default" size="sm">
                        Unassigned
                      </Badge>
                    )}
                    {brand.isSingleDedicatedStaff ? (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                        Single Dedicated (~80%)
                      </span>
                    ) : (
                      <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-semibold">
                        Multi-Staffed
                      </span>
                    )}
                  </div>

                  {/* SLA requirement preview */}
                  <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-800">SLA:</span> {brand.operatingRequirements}
                  </div>

                  {/* Processes */}
                  <div className="mt-3">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Processes:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {brandProcs.map((proc) => (
                        <span
                          key={proc.id}
                          className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 inline-flex items-center gap-1"
                        >
                          <span>{proc.name}</span>
                          <span className="text-[10px] text-indigo-400 font-mono">({proc.code})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer with assigned staff count & details trigger */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span>
                      <strong>{brandAsgns.length}</strong> staff mapped
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    size="xs"
                    icon={Eye}
                    onClick={() => {
                      setSelectedBrandForView(brand);
                      setIsDetailsModalOpen(true);
                    }}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Brand Form Modal */}
      <BrandFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedBrandForEdit(null);
        }}
        onSubmit={handleCreateOrUpdateBrand}
        brand={selectedBrandForEdit}
        pods={pods}
        processes={processes}
        loading={actionLoading}
      />

      {/* Brand Details Modal */}
      <BrandDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedBrandForView(null);
        }}
        brand={selectedBrandForView}
        pod={pods.find((p) => p.id === selectedBrandForView?.podId)}
        pods={pods}
        assignedEmployees={assignments
          .filter((a) => a.brandId === selectedBrandForView?.id)
          .map((a) => ({
            assignment: a,
            employee: employees.find((e) => e.id === a.employeeId),
          }))
          .filter((item) => Boolean(item.employee))}
        processes={processes}
        onEdit={() => {
          setIsDetailsModalOpen(false);
          setSelectedBrandForEdit(selectedBrandForView);
          setIsFormModalOpen(true);
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setBrandToDelete(null);
        }}
        onConfirm={handleDeleteBrand}
        title={brandToDelete?.status === 'INACTIVE' ? 'Permanently Delete Brand' : 'Delete / Deactivate Brand'}
        message={
          brandToDelete?.status === 'INACTIVE'
            ? `Are you sure you want to permanently delete brand '${brandToDelete?.name}' from the database? This cannot be undone.`
            : `Are you sure you want to delete brand '${brandToDelete?.name}'? Active employee assignments or working rules will prevent deletion.`
        }
        type="danger"
        confirmText={brandToDelete?.status === 'INACTIVE' ? 'Permanently Delete' : 'Delete Brand'}
        loading={actionLoading}
      />
    </div>
  );
}

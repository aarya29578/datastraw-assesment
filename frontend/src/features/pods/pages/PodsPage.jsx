import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Users,
  Crown,
  Edit2,
  Trash2,
  Eye,
  Building,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/common/Badge';
import { Card } from '../../../components/common/Card';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { PodFormModal } from '../components/PodFormModal';
import { PodMembersModal } from '../components/PodMembersModal';
import { podService } from '../services/podService';
import { employeeService } from '../../employees/services/employeeService';
import { brandService } from '../../brands/services/brandService';
import { useToast } from '../../../components/common/Toast';
import { formatErrorMessage } from '../../../utils/errorHandler';

export function PodsPage() {
  const { addToast } = useToast();
  const [pods, setPods] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedPodForEdit, setSelectedPodForEdit] = useState(null);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [selectedPodForMembers, setSelectedPodForMembers] = useState(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [podToDelete, setPodToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [podList, empList, brandList] = await Promise.all([
        podService.getPods(),
        employeeService.getEmployees(),
        brandService.getBrands(),
      ]);
      setPods(podList);
      setEmployees(empList);
      setBrands(brandList);
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to load operational pods'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateOrUpdatePod = async (formData) => {
    try {
      setActionLoading(true);
      if (selectedPodForEdit) {
        await podService.updatePod(selectedPodForEdit.id, formData);
        addToast(`Updated pod ${formData.name}`, 'success');
      } else {
        await podService.createPod(formData);
        addToast(`Created pod ${formData.name}`, 'success');
      }
      setIsFormModalOpen(false);
      setSelectedPodForEdit(null);
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to save pod details'), 'error');
      throw e;
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePod = async () => {
    if (!podToDelete) return;
    try {
      setActionLoading(true);
      await podService.deletePod(podToDelete.id);
      addToast(`Pod ${podToDelete.name} deleted`, 'success');
      setIsDeleteConfirmOpen(false);
      setPodToDelete(null);
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Error deleting pod'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Pods"
        subtitle="Cross-functional fleets organized by brand domain, lead hierarchy, and operational specialty"
        badge={<Badge variant="primary">{pods.length} Active Pods</Badge>}
      >
        <Button
          icon={Plus}
          onClick={() => {
            setSelectedPodForEdit(null);
            setIsFormModalOpen(true);
          }}
        >
          Create Pod
        </Button>
      </PageHeader>

      {/* Grid of Pod Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {pods.map((pod) => {
          const podLead =
            employees.find((e) => e.id === pod.leadId && e.podId === pod.id) ||
            (pod.leadEmployee && employees.find((e) => e.id === pod.leadEmployee.id && e.podId === pod.id)) ||
            null;
          const podMembers = employees.filter((e) => e.podId === pod.id);
          const activeMembers = podMembers.filter((e) => e.status === 'ACTIVE');
          const inactiveMembers = podMembers.filter((e) => e.status !== 'ACTIVE');
          const podBrands = pod.brands || [];

          return (
            <div
              key={pod.id}
              className="bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col overflow-hidden"
            >
              {/* Header with color stripe */}
              <div className="p-5 flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {pod.code || 'POD'}
                      </span>
                      <Badge variant="default" size="sm">
                        {activeMembers.length} Active{inactiveMembers.length > 0 ? ` • ${inactiveMembers.length} Inactive` : ''}
                      </Badge>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-2">{pod.name}</h3>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                      {pod.description || 'No description specified.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPodForEdit(pod);
                        setIsFormModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      title="Edit Pod"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPodToDelete(pod);
                        setIsDeleteConfirmOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Delete Pod"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Pod Lead Profile Card */}
                <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                      {podLead ? (podLead.avatar || podLead.full_name?.slice(0, 2)?.toUpperCase() || 'PL') : 'PL'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-800">
                          {podLead ? (podLead.fullName || podLead.full_name) : 'Unassigned Lead'}
                        </span>
                        <Crown className="w-3 h-3 text-amber-500 fill-amber-500" />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {podLead ? podLead.designation : 'Pod Lead'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    Lead
                  </span>
                </div>

                {/* Associated Brands & Handled Processes */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-slate-700">Assigned Brands:</span>
                    <span className="text-slate-500 font-medium">
                      {podBrands.length} {podBrands.length === 1 ? 'brand' : 'brands'}
                    </span>
                  </div>

                  {podBrands.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-1">No brands assigned yet</p>
                  ) : (
                    <div className="space-y-2">
                      {podBrands.map((b) => (
                        <div
                          key={b.id}
                          className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="font-semibold text-xs text-slate-800">
                              {b.name}
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                              {b.employeeCount} {b.employeeCount === 1 ? 'Employee' : 'Employees'}
                            </span>
                          </div>
                          {b.processNames && b.processNames.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {b.processNames.map((pName, pIdx) => (
                                <span
                                  key={pIdx}
                                  className="px-2 py-0.5 rounded bg-white text-slate-700 font-medium text-[10px] border border-slate-200 shadow-2xs"
                                >
                                  {pName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-400 italic">No active processes</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer action to view all employees */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex -space-x-1.5 overflow-hidden">
                  {podMembers.slice(0, 5).map((m) => (
                    <div
                      key={m.id}
                      title={m.fullName}
                      className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-slate-200 text-[10px] font-semibold flex items-center justify-center text-slate-700"
                    >
                      {m.avatar}
                    </div>
                  ))}
                  {podMembers.length > 5 && (
                    <div className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-indigo-100 text-[10px] font-semibold flex items-center justify-center text-indigo-700">
                      +{podMembers.length - 5}
                    </div>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="xs"
                  icon={Eye}
                  onClick={() => {
                    setSelectedPodForMembers(pod);
                    setIsMembersModalOpen(true);
                  }}
                >
                  View {podMembers.length} Members
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pod Form Modal */}
      <PodFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedPodForEdit(null);
        }}
        onSubmit={handleCreateOrUpdatePod}
        pod={selectedPodForEdit}
        employees={employees}
        loading={actionLoading}
      />

      {/* Pod Members Modal */}
      <PodMembersModal
        isOpen={isMembersModalOpen}
        onClose={() => {
          setIsMembersModalOpen(false);
          setSelectedPodForMembers(null);
        }}
        pod={selectedPodForMembers}
        members={employees.filter((e) => e.podId === selectedPodForMembers?.id)}
        lead={employees.find((e) => e.id === selectedPodForMembers?.leadId && e.podId === selectedPodForMembers?.id)}
      />

      {/* Delete Pod Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setPodToDelete(null);
        }}
        onConfirm={handleDeletePod}
        title="Delete Operational Pod"
        message={`Are you sure you want to delete ${podToDelete?.name}? Please make sure to reassign all member employees and brands first.`}
        type="danger"
        confirmText="Delete Pod"
        loading={actionLoading}
      />
    </div>
  );
}

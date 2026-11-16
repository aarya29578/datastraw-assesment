import React, { useState, useEffect } from 'react';
import {
  CalendarClock,
  Plus,
  Building2,
  Workflow,
  CheckCircle2,
  Calendar,
  Users,
  Edit2,
  Trash2,
  Clock,
  Info,
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/common/Badge';
import { Select } from '../../../components/ui/Select';
import { EmptyState } from '../../../components/common/EmptyState';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { WorkingRuleFormModal } from '../components/WorkingRuleFormModal';
import { workingRuleService } from '../services/workingRuleService';
import { brandService } from '../../brands/services/brandService';
import { processService } from '../../processes/services/processService';
import { useToast } from '../../../components/common/Toast';
import { OPERATING_PATTERN_LABELS } from '../../../constants/workingRuleEnums';
import { formatErrorMessage } from '../../../utils/errorHandler';

export function WorkingRulesPage() {
  const { addToast } = useToast();
  const [workingRules, setWorkingRules] = useState([]);
  const [brands, setBrands] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [brandFilter, setBrandFilter] = useState('');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedRuleForEdit, setSelectedRuleForEdit] = useState(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rules, brandList, procList] = await Promise.all([
        workingRuleService.getWorkingRules(),
        brandService.getBrands(),
        processService.getProcesses(),
      ]);
      setWorkingRules(rules);
      setBrands(brandList);
      setProcesses(procList);
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to load working rules'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRules = workingRules.filter((r) =>
    brandFilter ? r.brandId === brandFilter : true
  );

  const handleCreateOrUpdateRule = async (formData) => {
    try {
      setActionLoading(true);
      if (selectedRuleForEdit) {
        await workingRuleService.updateWorkingRule(selectedRuleForEdit.id, formData);
        addToast('Working rule updated', 'success');
      } else {
        await workingRuleService.createWorkingRule(formData);
        addToast('Working rule created', 'success');
      }
      setIsFormModalOpen(false);
      setSelectedRuleForEdit(null);
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, selectedRuleForEdit ? 'Failed to update working rule' : 'Failed to create working rule'), 'error');
      throw e;
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!ruleToDelete) return;
    try {
      setActionLoading(true);
      await workingRuleService.deleteWorkingRule(ruleToDelete.id);
      addToast('Working rule removed', 'success');
      setIsDeleteConfirmOpen(false);
      setRuleToDelete(null);
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to delete rule'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Working & Operating Rules"
        subtitle="Configure operating calendars and minimum staffing rules per client brand and process"
        badge={<Badge variant="primary">{workingRules.length} Active Rules</Badge>}
      >
        <Button
          icon={Plus}
          onClick={() => {
            setSelectedRuleForEdit(null);
            setIsFormModalOpen(true);
          }}
        >
          Add Working Rule
        </Button>
      </PageHeader>

      {/* Architectural Concept Banner */}
      <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-950 leading-relaxed">
          <strong>Calendar Architecture Distinction:</strong> Brand and Process operating calendars define when service is mandatory (such as 365-day continuous operations or custom operating day schedules with minimum staffing thresholds). These are distinct from individual employee schedules (which respect weekly offs and approved leaves). When an operating requirement has fewer working staff than minimum required, an active conflict is triggered automatically.
        </div>
      </div>

      {/* Brand Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="w-full sm:w-64">
          <Select
            placeholder="All Client Brands"
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            options={[
              { value: '', label: 'All Client Brands' },
              ...brands.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        </div>

        {brandFilter && (
          <Button variant="ghost" size="sm" onClick={() => setBrandFilter('')}>
            Reset Filter
          </Button>
        )}
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400 text-xs">
            Loading operating rules...
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={CalendarClock}
              title="No working rules configured"
              description="Configure operating days and minimum staffing requirements for your brands."
              actionLabel="Add Working Rule"
              onAction={() => {
                setSelectedRuleForEdit(null);
                setIsFormModalOpen(true);
              }}
            />
          </div>
        ) : (
          filteredRules.map((rule) => {
            const brand = brands.find((b) => b.id === rule.brandId);
            const process = processes.find((p) => p.id === rule.processId);

            return (
              <div
                key={rule.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900">
                          {brand ? brand.name : rule.brandId}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-sm font-semibold text-indigo-700">
                          {process?.name || 'Process'}
                        </span>
                        {process?.code && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-slate-100 border border-slate-200">
                            {process.code}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRuleForEdit(rule);
                          setIsFormModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                        title="Edit Rule"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRuleToDelete(rule);
                          setIsDeleteConfirmOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Pattern & Staffing Stats */}
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Calendar Pattern
                      </span>
                      <p className="text-xs font-bold text-slate-800 mt-1">
                        {OPERATING_PATTERN_LABELS[rule.pattern] || rule.pattern}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Min Staff Required
                      </span>
                      <p className="text-xs font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{rule.minStaffRequired} Specialists</span>
                      </p>
                    </div>
                  </div>

                  {/* Operating Days */}
                  <div className="mt-4">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Operating Days ({rule.operatingDays.length}/7):
                    </span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayShort, idx) => {
                        const fullDays = [
                          'Monday',
                          'Tuesday',
                          'Wednesday',
                          'Thursday',
                          'Friday',
                          'Saturday',
                          'Sunday',
                        ];
                        const fullDay = fullDays[idx];
                        const isActive = rule.operatingDays.includes(fullDay);

                        return (
                          <span
                            key={dayShort}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isActive
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {dayShort}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Holiday status */}
                  <div className="mt-3 text-xs flex items-center gap-2">
                    <span className="text-slate-500 font-medium">Holiday Coverage:</span>
                    {rule.operatesOnHolidays ? (
                      <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                        Operates on Public Holidays (365)
                      </span>
                    ) : (
                      <span className="text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        Closed on Public Holidays
                      </span>
                    )}
                  </div>
                </div>

                {rule.notes && (
                  <p className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 italic">
                    Note: {rule.notes}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Form Modal */}
      <WorkingRuleFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedRuleForEdit(null);
        }}
        onSubmit={handleCreateOrUpdateRule}
        rule={selectedRuleForEdit}
        brands={brands}
        processes={processes}
        loading={actionLoading}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setRuleToDelete(null);
        }}
        onConfirm={handleDeleteRule}
        title="Delete Working Rule"
        message="Are you sure you want to delete this working rule? Roster validation will no longer enforce minimum staffing for this process on this brand."
        type="danger"
        confirmText="Delete Rule"
        loading={actionLoading}
      />
    </div>
  );
}

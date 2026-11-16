import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Filter,
  Sparkles,
  Users,
  RotateCcw,
  ArrowRight,
  HelpCircle,
  Lock,
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/common/Badge';
import { Select } from '../../../components/ui/Select';
import { EmptyState } from '../../../components/common/EmptyState';
import { ConflictResolutionModal } from '../components/ConflictResolutionModal';
import { conflictService } from '../services/conflictService';
import { employeeService } from '../../employees/services/employeeService';
import { rosterService } from '../../roster/services/rosterService';
import { useToast } from '../../../components/common/Toast';
import { formatReadableDate } from '../../../utils/dateUtils';
import { CONFLICT_SEVERITY } from '../../../constants/conflictEnums';
import { formatErrorMessage } from '../../../utils/errorHandler';

export function ConflictsPage() {
  const { addToast } = useToast();
  const [conflicts, setConflicts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('OPEN'); // 'OPEN' or 'ALL' or 'RESOLVED'

  // Resolution modal
  const [isResolutionOpen, setIsResolutionOpen] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [confList, empList] = await Promise.all([
        conflictService.getConflicts(),
        employeeService.getEmployees(),
      ]);
      setConflicts(confList);
      setEmployees(empList);
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to load conflicts'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen to conflicts-updated event from other pages or background tasks
    const handleConflictsUpdated = () => {
      loadData();
    };
    window.addEventListener('roster:conflicts-updated', handleConflictsUpdated);
    return () => {
      window.removeEventListener('roster:conflicts-updated', handleConflictsUpdated);
    };
  }, []);

  const filteredConflicts = conflicts.filter((c) => {
    const matchesSeverity = severityFilter ? c.severity === severityFilter : true;
    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'OPEN'
        ? c.status === 'OPEN'
        : c.status === 'RESOLVED';
    return matchesSeverity && matchesStatus;
  });

  // Handle workflow to create draft revision from published roster
  const handleCreateDraftRevision = async (conflict) => {
    if (!conflict) return;
    try {
      setIsCreatingRevision(true);
      const dateParts = conflict.date.split('-');
      const year = conflict.rosterYear || parseInt(dateParts[0], 10);
      const month = conflict.rosterMonth || parseInt(dateParts[1], 10);

      // Trigger generation of draft revision (Revision N+1)
      await rosterService.generateRoster(year, month);

      // Re-fetch conflicts and employees
      const [freshConflicts, freshEmployees] = await Promise.all([
        conflictService.getConflicts(),
        employeeService.getEmployees(),
      ]);
      setConflicts(freshConflicts);
      setEmployees(freshEmployees);

      // Find matching conflict on the newly created draft roster
      const matchingNewConflict = freshConflicts.find(
        (c) =>
          c.date === conflict.date &&
          c.brandId === conflict.brandId &&
          c.processId === conflict.processId &&
          c.conflictType === conflict.conflictType &&
          c.status === 'OPEN' &&
          c.rosterStatus !== 'PUBLISHED'
      );

      if (matchingNewConflict) {
        setSelectedConflict(matchingNewConflict);
        addToast(
          `Created Draft Revision ${matchingNewConflict.rosterVersion || 2}! You can now assign a replacement specialist.`,
          'success'
        );
      } else {
        // If not found as open, maybe the draft re-calculation resolved it or roster is clean
        setIsResolutionOpen(false);
        setSelectedConflict(null);
        addToast(
          `Draft revision created and revalidated. Target conflict was resolved or updated.`,
          'success'
        );
      }

      window.dispatchEvent(new CustomEvent('roster:conflicts-updated'));
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to create draft revision'), 'error');
    } finally {
      setIsCreatingRevision(false);
    }
  };

  const handleResolveConflict = async (resolutionData) => {
    if (!selectedConflict) return;
    if (actionLoading) return;

    try {
      setActionLoading(true);

      if (resolutionData.replacementEmployeeId) {
        // Coordinated atomic replacement & revalidation call
        await conflictService.resolveWithReplacement(selectedConflict.id, {
          replacementEmployeeId: resolutionData.replacementEmployeeId,
          note: resolutionData.note,
        });
      } else {
        // Standard resolution with note only
        await conflictService.resolveConflict(selectedConflict.id, resolutionData.note);
      }

      // Dispatch event to update sidebar badge immediately
      window.dispatchEvent(new CustomEvent('roster:conflicts-updated'));

      addToast(
        `Conflict resolved! Replacement scheduled on ${formatReadableDate(selectedConflict.date)}. Roster revalidated.`,
        'success'
      );
      setIsResolutionOpen(false);
      setSelectedConflict(null);

      // Refresh page data from backend
      await loadData();
    } catch (e) {
      console.error(e);
      const errMsg = e?.message || '';

      // Gracefully handle "conflict already resolved" without breaking UI
      if (errMsg.includes('already been resolved') || e?.code === 'CONFLICT_ALREADY_RESOLVED') {
        addToast('This conflict has already been resolved. Refreshing conflict status...', 'info');
        setIsResolutionOpen(false);
        setSelectedConflict(null);
        await loadData();
        window.dispatchEvent(new CustomEvent('roster:conflicts-updated'));
        return;
      }

      // Gracefully handle published roster block
      if (errMsg.includes('published roster') || e?.code === 'PUBLISHED_ROSTER_LOCKED') {
        addToast(
          'Cannot modify entries on a published roster. Please click "Create Draft Revision" to unlock modifications.',
          'warning'
        );
        return;
      }

      addToast(formatErrorMessage(e, 'Failed to resolve conflict'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openCount = conflicts.filter((c) => c.status === 'OPEN').length;
  const criticalCount = conflicts.filter((c) => c.status === 'OPEN' && c.severity === 'CRITICAL').length;
  const warningCount = conflicts.filter((c) => c.status === 'OPEN' && c.severity === 'WARNING').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conflict & Coverage Gap Management"
        subtitle="Detect, investigate, and remediate staffing shortages, rule breaches, and availability overlaps"
        badge={
          <Badge variant={criticalCount > 0 ? 'danger' : 'success'}>
            {openCount} Open Conflicts ({criticalCount} Critical)
          </Badge>
        }
      />

      {/* Conflict Operational Policy Banner */}
      <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-xl shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Automated Conflict & Coverage Monitoring
              </h3>
            </div>
            <p className="mt-1 text-xs text-amber-900 leading-relaxed">
              Conflicts are automatically evaluated when scheduled shifts intersect with brand working rules, minimum staffing requirements, and approved employee leaves. Critical violations represent mandatory staffing deficits where active staff falls below operating minimums.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-500">
              Critical Mandatory Gaps
            </span>
            <p className="text-2xl font-bold text-rose-900 mt-1">{criticalCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Below minimum SLA requirement</p>
          </div>
          <div className="p-3 rounded-lg bg-rose-50 text-rose-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-500">
              Preference & Overlap Warnings
            </span>
            <p className="text-2xl font-bold text-amber-900 mt-1">{warningCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Non-blocking operational alerts</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500">
              Resolved Gaps
            </span>
            <p className="text-2xl font-bold text-emerald-900 mt-1">
              {conflicts.filter((c) => c.status === 'RESOLVED').length}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Remediated with backup staff</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-48">
            <Select
              placeholder="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'OPEN', label: 'Open Conflicts Only' },
                { value: 'RESOLVED', label: 'Resolved Only' },
                { value: 'ALL', label: 'All Records' },
              ]}
            />
          </div>

          <div className="w-48">
            <Select
              placeholder="All Severities"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              options={[
                { value: '', label: 'All Severities' },
                { value: 'CRITICAL', label: 'Critical' },
                { value: 'WARNING', label: 'Warning' },
                { value: 'INFO', label: 'Info' },
              ]}
            />
          </div>
        </div>

        {(severityFilter || statusFilter !== 'OPEN') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSeverityFilter('');
              setStatusFilter('OPEN');
            }}
          >
            Reset Filters
          </Button>
        )}
      </div>

      {/* Conflict Cards List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs">
            Analyzing operational conflicts...
          </div>
        ) : filteredConflicts.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No conflicts found"
            description="All active shifts satisfy brand minimum staffing rules and employee availability constraints."
          />
        ) : (
          filteredConflicts.map((conf) => {
            const isCritical = conf.severity === 'CRITICAL';
            const isResolved = conf.status === 'RESOLVED';
            const isPublished =
              conf.rosterStatus === 'PUBLISHED' || conf.roster?.status === 'PUBLISHED';
            const requiredNum = conf.requiredCount ?? conf.requiredStaffCount ?? 1;
            const availableNum = conf.availableCount ?? conf.availableStaffCount ?? 0;

            return (
              <div
                key={conf.id}
                className={`bg-white rounded-xl border p-5 transition-all shadow-xs ${
                  isResolved
                    ? 'border-slate-200 opacity-75'
                    : isCritical
                    ? 'border-rose-300 ring-1 ring-rose-100 hover:shadow-md'
                    : 'border-amber-300 ring-1 ring-amber-100 hover:shadow-md'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left Side: Conflict Details */}
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                        isResolved
                          ? 'bg-slate-100 text-slate-500'
                          : isCritical
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {isResolved ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900">
                          {conf.brandName} • {conf.processName}
                        </h4>
                        <Badge
                          variant={
                            isResolved
                              ? 'default'
                              : isCritical
                              ? 'danger'
                              : 'warning'
                          }
                          size="sm"
                        >
                          {conf.severity}
                        </Badge>

                        {/* Roster Revision & Publication Badge */}
                        {conf.rosterVersion && (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${
                              isPublished
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {isPublished && <Lock className="w-2.5 h-2.5" />}
                            Rev {conf.rosterVersion} • {conf.rosterStatus || 'DRAFT'}
                          </span>
                        )}

                        <span className="text-[11px] font-semibold text-slate-500">
                          Target Date: <strong>{formatReadableDate(conf.date)}</strong>
                        </span>
                      </div>

                      <p className="mt-1.5 text-xs text-slate-700 leading-relaxed">
                        {conf.reason || conf.description}
                      </p>

                      {/* Staffing Numbers */}
                      <div className="mt-3 flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          Required: <strong>{requiredNum}</strong>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span
                          className={`flex items-center gap-1.5 ${
                            availableNum < requiredNum
                              ? 'text-rose-600 font-bold'
                              : 'text-emerald-600 font-semibold'
                          }`}
                        >
                          Available: <strong>{availableNum}</strong>
                        </span>
                      </div>

                      {/* Suggested Resolution Box */}
                      {conf.suggestedResolution && (
                        <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700">
                          <span className="font-semibold text-slate-900 block mb-0.5">
                            💡 Suggested Resolution:
                          </span>
                          {conf.suggestedResolution}
                        </div>
                      )}

                      {/* Resolved note if already resolved */}
                      {isResolved && (conf.resolutionNote || conf.suggestedResolution) && (
                        <div className="mt-2 text-[11px] text-emerald-700 font-medium">
                          ✓ Remediated: {conf.resolutionNote || conf.suggestedResolution}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Action Button */}
                  <div className="sm:self-center shrink-0">
                    {!isResolved ? (
                      <Button
                        variant={isCritical ? 'danger' : 'primary'}
                        size="sm"
                        onClick={() => {
                          setSelectedConflict(conf);
                          setIsResolutionOpen(true);
                        }}
                      >
                        Review & Resolve
                      </Button>
                    ) : (
                      <Badge variant="success">Resolved</Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Conflict Resolution Modal */}
      <ConflictResolutionModal
        isOpen={isResolutionOpen}
        onClose={() => {
          setIsResolutionOpen(false);
          setSelectedConflict(null);
        }}
        conflict={selectedConflict}
        availableEmployees={employees}
        onSubmit={handleResolveConflict}
        onCreateDraftRevision={handleCreateDraftRevision}
        loading={actionLoading}
        isCreatingRevision={isCreatingRevision}
      />
    </div>
  );
}

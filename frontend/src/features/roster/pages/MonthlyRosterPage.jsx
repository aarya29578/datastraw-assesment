import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Filter,
  Download,
  Info,
  ChevronLeft,
  ChevronRight,
  Layers,
  Building2,
  Workflow,
  Users,
  Send,
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/common/Badge';
import { Select } from '../../../components/ui/Select';
import { RosterEditModal } from '../components/RosterEditModal';
import { RosterValidationDrawer } from '../components/RosterValidationDrawer';
import { rosterService } from '../services/rosterService';
import { employeeService } from '../../employees/services/employeeService';
import { podService } from '../../pods/services/podService';
import { brandService } from '../../brands/services/brandService';
import { processService } from '../../processes/services/processService';
import { assignmentService } from '../../assignments/services/assignmentService';
import { workingRuleService } from '../../working-rules/services/workingRuleService';
import { availabilityService } from '../../availability/services/availabilityService';
import { useToast } from '../../../components/common/Toast';
import { useRosterCycle } from '../../../context/RosterCycleContext';
import { formatErrorMessage } from '../../../utils/errorHandler';
import {
  ROSTER_STATUS,
  ROSTER_STATUS_CONFIG,
  getRosterStatusConfig,
} from '../../../constants/rosterStatuses';
import {
  getMonthDaysArray,
  MONTH_NAMES,
  formatDateKey,
} from '../../../utils/dateUtils';

export function MonthlyRosterPage() {
  const { addToast } = useToast();
  const { selectedYear, selectedMonth, setSelectedYear, setSelectedMonth } = useRosterCycle();

  // View modes: COMPANY, POD, BRAND, PROCESS, EMPLOYEE
  const [viewMode, setViewMode] = useState('COMPANY');
  const [selectedFilterId, setSelectedFilterId] = useState('');

  // Data states
  const [rosterGrid, setRosterGrid] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [pods, setPods] = useState([]);
  const [brands, setBrands] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [workingRules, setWorkingRules] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);

  // Manual Edit Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { employee, dateKey, entry }

  // Validation Drawer
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [validationConflicts, setValidationConflicts] = useState([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [currentRoster, setCurrentRoster] = useState(null);

  // Load all foundational data
  const loadData = async () => {
    try {
      setLoading(true);
      const [
        grid,
        empList,
        podList,
        brandList,
        procList,
        asgnList,
        ruleList,
        holList,
        rosterObj,
      ] = await Promise.all([
        rosterService.getRosterGrid(selectedYear, selectedMonth),
        employeeService.getEmployees(),
        podService.getPods(),
        brandService.getBrands(),
        processService.getProcesses(),
        assignmentService.getAssignments(),
        workingRuleService.getWorkingRules(),
        availabilityService.getHolidays(),
        rosterService.getCurrentRoster(selectedYear, selectedMonth),
      ]);

      setRosterGrid(grid);
      setEmployees(empList);
      setPods(podList);
      setBrands(brandList);
      setProcesses(procList);
      setAssignments(asgnList);
      setWorkingRules(ruleList);
      setHolidays(holList);
      setCurrentRoster(rosterObj);
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to load roster data'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMonth]);

  // Days array for the month
  const monthDays = getMonthDaysArray(selectedYear, selectedMonth);

  // Filtered active employees according to view mode
  const getVisibleEmployees = () => {
    const activeEmps = employees.filter((e) => e.status !== 'INACTIVE');
    if (viewMode === 'COMPANY') {
      return activeEmps;
    }
    if (viewMode === 'POD' && selectedFilterId) {
      return activeEmps.filter((e) => e.podId === selectedFilterId);
    }
    if (viewMode === 'BRAND' && selectedFilterId) {
      const brandAsgns = assignments.filter((a) => a.brandId === selectedFilterId);
      const empIds = brandAsgns.map((a) => a.employeeId);
      return activeEmps.filter((e) => empIds.includes(e.id));
    }
    if (viewMode === 'PROCESS' && selectedFilterId) {
      const procAsgns = assignments.filter((a) => a.processIds?.includes(selectedFilterId) || a.processId === selectedFilterId);
      const empIds = procAsgns.map((a) => a.employeeId);
      return activeEmps.filter((e) => empIds.includes(e.id));
    }
    if (viewMode === 'EMPLOYEE' && selectedFilterId) {
      return activeEmps.filter((e) => e.id === selectedFilterId);
    }
    return activeEmps;
  };

  const visibleEmployees = getVisibleEmployees();

  // Handle cell click
  const handleCellClick = (employee, dateKey) => {
    if (!currentRoster || !rosterGrid) return;
    const entry = rosterGrid[employee.id]?.[dateKey];
    if (!entry) return;
    setEditingCell({ employee, dateKey, entry });
    setIsEditModalOpen(true);
  };

  // Submit manual edit
  const handleSaveCellEdit = async ({ status, note }) => {
    if (!editingCell || !currentRoster?.id) return;
    try {
      const { employee, dateKey, entry } = editingCell;
      await rosterService.updateRosterCell(employee.id, dateKey, status, note, {
        rosterId: currentRoster.id,
        entryId: entry?.entry_id,
      });
      addToast(`Updated shift for ${employee.fullName} on ${dateKey}`, 'success');
      setIsEditModalOpen(false);
      setEditingCell(null);
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Error saving manual shift edit'), 'error');
    }
  };

  // Generate Roster
  const handleGenerateRoster = async () => {
    if (isGenerating) return;
    try {
      setIsGenerating(true);
      await rosterService.generateRoster(selectedYear, selectedMonth);
      addToast(
        `Generated monthly roster for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`,
        'success'
      );
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to generate roster'), 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Validate Roster Action
  const handleValidateRoster = async () => {
    if (!currentRoster?.id) {
      addToast('No roster found to validate. Please generate a roster first.', 'warning');
      return;
    }
    try {
      setIsValidating(true);
      const conflicts = await rosterService.validateRoster({
        year: selectedYear,
        month: selectedMonth,
      });
      setValidationConflicts(conflicts);
      setIsValidationOpen(true);
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Validation error occurred'), 'error');
    } finally {
      setIsValidating(false);
    }
  };

  // Publish Roster Action
  const handlePublishRoster = async () => {
    if (!currentRoster?.id) {
      addToast('No roster found to publish. Please generate a roster first.', 'warning');
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to publish the roster for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}? Once published, shift assignments will be finalized.`
    );
    if (!confirmed) return;

    try {
      setIsPublishing(true);
      await rosterService.publishRoster(currentRoster.id);
      addToast(
        `Roster for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear} published successfully!`,
        'success'
      );
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to publish roster'), 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const isRosterPublished = currentRoster?.status === 'PUBLISHED';
  const hasRosterData = Boolean(currentRoster?.id && rosterGrid && Object.keys(rosterGrid).length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly Operations Roster"
        subtitle={`Scheduled duty rosters across workforce members for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}
        badge={
          <Badge variant={isRosterPublished ? 'success' : 'primary'}>
            {isRosterPublished
              ? 'PUBLISHED'
              : currentRoster
              ? `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear} Cycle (${currentRoster.status})`
              : 'NOT GENERATED'}
          </Badge>
        }
      >
        <Button
          variant="outline"
          size="sm"
          icon={CheckCircle2}
          onClick={handleValidateRoster}
          loading={isValidating}
          disabled={!currentRoster}
        >
          Validate Roster
        </Button>
        <Button
          variant="outline"
          size="sm"
          icon={Send}
          onClick={handlePublishRoster}
          loading={isPublishing}
          disabled={!currentRoster || isRosterPublished}
        >
          {isRosterPublished ? 'Published' : 'Publish Roster'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon={Sparkles}
          onClick={handleGenerateRoster}
          loading={isGenerating}
          disabled={isGenerating}
        >
          {currentRoster ? 'Regenerate Roster' : 'Generate Roster'}
        </Button>
      </PageHeader>

      {/* Toolbar: Month/Year selector & View Modes */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Month & Year Selection */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-800 border-none focus:ring-0 cursor-pointer pr-6"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-800 border-none focus:ring-0 cursor-pointer"
            >
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            View Filter:
          </span>
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            {[
              { id: 'COMPANY', label: 'Company-Wide', icon: Users },
              { id: 'POD', label: 'Pod-Wise', icon: Layers },
              { id: 'BRAND', label: 'Brand-Wise', icon: Building2 },
              { id: 'PROCESS', label: 'Process-Wise', icon: Workflow },
              { id: 'EMPLOYEE', label: 'Employee-Wise', icon: Users },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setViewMode(v.id);
                  setSelectedFilterId('');
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  viewMode === v.id
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Secondary Filter Dropdown when sub-view is selected */}
          {viewMode === 'POD' && (
            <div className="w-48">
              <Select
                placeholder="Choose Pod..."
                value={selectedFilterId}
                onChange={(e) => setSelectedFilterId(e.target.value)}
                options={pods.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
          )}

          {viewMode === 'BRAND' && (
            <div className="w-48">
              <Select
                placeholder="Choose Brand..."
                value={selectedFilterId}
                onChange={(e) => setSelectedFilterId(e.target.value)}
                options={brands.map((b) => ({ value: b.id, label: b.name }))}
              />
            </div>
          )}

          {viewMode === 'PROCESS' && (
            <div className="w-56">
              <Select
                placeholder="Choose Process..."
                value={selectedFilterId}
                onChange={(e) => setSelectedFilterId(e.target.value)}
                options={processes
                  .filter((p) => p.status === 'ACTIVE' || p.id === selectedFilterId)
                  .map((p) => ({
                    value: p.id,
                    label: `${p.name} (${p.code})`,
                  }))}
              />
            </div>
          )}

          {viewMode === 'EMPLOYEE' && (
            <div className="w-56">
              <Select
                placeholder="Choose Employee..."
                value={selectedFilterId}
                onChange={(e) => setSelectedFilterId(e.target.value)}
                options={visibleEmployees.map((e) => ({
                  value: e.id,
                  label: `${e.fullName} (${e.employeeId})`,
                }))}
              />
            </div>
          )}
        </div>
      </div>

      {/* Status Legend */}
      <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-4 flex-wrap text-xs">
        <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px]">
          Status Legend:
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(ROSTER_STATUS_CONFIG)
            .filter(([key]) => !key.includes(' ') && !key.includes('-'))
            .map(([stKey, cfg]) => (
              <div key={stKey} className="flex items-center gap-1.5">
                <span
                  className={`w-5 h-5 rounded font-bold text-[10px] flex items-center justify-center border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                >
                  {cfg.code}
                </span>
                <span className="text-slate-600 font-medium">{cfg.label}</span>
              </div>
            ))}
        </div>
        <span className="text-[11px] text-slate-400 italic">
          💡 Click any cell to manually edit shift or leave note
        </span>
      </div>

      {/* Roster Calendar Grid / Empty State */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-24 text-center text-slate-400 text-xs">
            Loading roster schedule grid...
          </div>
        ) : !hasRosterData ? (
          <div className="py-20 px-6 text-center max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                No roster generated for this month
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                No roster generated for this month. Click Generate Roster to create one.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              icon={Sparkles}
              onClick={handleGenerateRoster}
              loading={isGenerating}
            >
              Generate Roster
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs select-none">
              <thead className="sticky top-0 z-20 bg-slate-100 shadow-xs">
                <tr>
                  {/* Sticky Employee Column */}
                  <th className="py-2.5 px-3 sticky left-0 z-30 bg-slate-100 border-r border-b border-slate-300 w-56 min-w-[220px]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Workforce ({visibleEmployees.length})
                    </span>
                  </th>

                  {/* Day Columns */}
                  {monthDays.map((d) => (
                    <th
                      key={d.day}
                      className={`py-2 px-1 text-center border-b border-r border-slate-200 min-w-[34px] ${
                        d.isSunday
                          ? 'bg-rose-50/80 text-rose-700'
                          : d.isSaturday
                          ? 'bg-amber-50/50 text-amber-800'
                          : 'text-slate-600'
                      }`}
                    >
                      <div className="text-[10px] uppercase font-bold">{d.dayOfWeek.slice(0, 2)}</div>
                      <div className="text-xs font-extrabold">{d.day}</div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {visibleEmployees.map((emp) => {
                  const pod = pods.find((p) => p.id === emp.podId);

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Sticky Employee Name & Role */}
                      <td className="py-2 px-3 sticky left-0 z-10 bg-white border-r border-slate-200 shadow-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {emp.avatar}
                          </div>
                          <div className="truncate">
                            <p className="font-semibold text-slate-900 truncate leading-tight">
                              {emp.fullName}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {pod ? pod.name.split(' ')[1] : emp.podId} • Off: {emp.weeklyOff.slice(0, 3)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Day Cells */}
                      {monthDays.map((d) => {
                        const cellData = rosterGrid?.[emp.id]?.[d.dateKey];

                        if (!cellData) {
                          return (
                            <td
                              key={d.dateKey}
                              className={`p-1 text-center border-r border-slate-100 ${
                                d.isSunday ? 'bg-slate-50/60' : ''
                              }`}
                            >
                              <div className="w-7 h-7 mx-auto rounded flex items-center justify-center font-bold text-[11px] text-slate-300">
                                —
                              </div>
                            </td>
                          );
                        }

                        const status = cellData.status;
                        const config = getRosterStatusConfig(status);
                        const isEdited = cellData.is_manually_edited || cellData.editedManually;

                        return (
                          <td
                            key={d.dateKey}
                            onClick={() => handleCellClick(emp, d.dateKey)}
                            title={`${emp.fullName} on ${d.dateKey}: ${config.label}${
                              cellData.notes || cellData.note ? ` (${cellData.notes || cellData.note})` : ''
                            }`}
                            className={`p-1 text-center border-r border-slate-100 cursor-pointer hover:scale-105 transition-transform ${
                              d.isSunday ? 'bg-slate-50/60' : ''
                            }`}
                          >
                            <div
                              className={`w-7 h-7 mx-auto rounded flex items-center justify-center font-bold text-[11px] border shadow-2xs relative ${config.bg} ${config.text} ${config.border}`}
                            >
                              {config.code}
                              {isEdited && (
                                <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-indigo-600" />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Edit Modal */}
      <RosterEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingCell(null);
        }}
        onSubmit={handleSaveCellEdit}
        employee={editingCell?.employee}
        dateKey={editingCell?.dateKey}
        currentEntry={editingCell?.entry}
      />

      {/* Validation Findings Drawer / Report */}
      <RosterValidationDrawer
        isOpen={isValidationOpen}
        onClose={() => setIsValidationOpen(false)}
        conflicts={validationConflicts}
        isValidating={isValidating}
      />
    </div>
  );
}

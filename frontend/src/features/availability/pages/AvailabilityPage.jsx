import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Plus,
  Coffee,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Search,
  Filter,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/common/Badge';
import { Tabs } from '../../../components/common/Tabs';
import { Card } from '../../../components/common/Card';
import { EmptyState } from '../../../components/common/EmptyState';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { LeaveRequestModal } from '../components/LeaveRequestModal';
import { availabilityService } from '../services/availabilityService';
import { employeeService } from '../../employees/services/employeeService';
import { rosterService } from '../../roster/services/rosterService';
import { useToast } from '../../../components/common/Toast';
import { formatReadableDate } from '../../../utils/dateUtils';
import { LEAVE_STATUS } from '../../../constants/availabilityEnums';
import { ROSTER_STATUS } from '../../../constants/rosterStatuses';
import { formatErrorMessage } from '../../../utils/errorHandler';

export function AvailabilityPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('LEAVES'); // 'LEAVES', 'WEEKLY_OFFS', 'COMP_OFFS', 'HOLIDAYS'
  const [leaves, setLeaves] = useState([]);
  const [compOffs, setCompOffs] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [leaveList, coList, holList, empList] = await Promise.all([
        availabilityService.getLeaves(),
        availabilityService.getCompOffs(),
        availabilityService.getHolidays(),
        employeeService.getEmployees(),
      ]);
      setLeaves(leaveList);
      setCompOffs(coList);
      setHolidays(holList);
      setEmployees(empList);
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to load availability records'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateLeave = async (formData) => {
    try {
      setActionLoading(true);
      await availabilityService.createLeave(formData);

      // If approved, update roster grid entry automatically
      if (formData.status === LEAVE_STATUS.APPROVED) {
        await rosterService.updateRosterCell(
          formData.employeeId,
          formData.startDate,
          ROSTER_STATUS.LEAVE,
          `Approved ${formData.type}: ${formData.reason}`
        );
      }

      addToast('Leave request recorded successfully', 'success');
      setIsLeaveModalOpen(false);
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Failed to record leave request'), 'error');
      throw e;
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateLeaveStatus = async (leaveId, newStatus, leaveObj) => {
    try {
      setActionLoading(true);
      await availabilityService.updateLeaveStatus(leaveId, newStatus);

      // Reflect in roster cell immediately
      const rosterCellStatus =
        newStatus === LEAVE_STATUS.APPROVED ? ROSTER_STATUS.LEAVE : ROSTER_STATUS.WORKING;

      await rosterService.updateRosterCell(
        leaveObj.employeeId,
        leaveObj.startDate,
        rosterCellStatus,
        newStatus === LEAVE_STATUS.APPROVED ? `Approved Leave: ${leaveObj.reason}` : 'Leave rejected/cancelled'
      );

      addToast(
        `Leave ${newStatus.toLowerCase()}! Roster updated and conflicts rechecked.`,
        'success'
      );
      await loadData();
    } catch (e) {
      console.error(e);
      addToast(formatErrorMessage(e, 'Error updating leave status'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const tabsConfig = [
    {
      id: 'LEAVES',
      label: 'Leave Requests & Approvals',
      icon: CalendarCheck,
      count: leaves.filter((l) => l.status === LEAVE_STATUS.PENDING).length,
    },
    {
      id: 'WEEKLY_OFFS',
      label: 'Weekly Off Configurations',
      icon: Coffee,
      count: employees.length,
    },
    {
      id: 'COMP_OFFS',
      label: 'Compensatory Offs',
      icon: Clock,
      count: compOffs.length,
    },
    {
      id: 'HOLIDAYS',
      label: 'Public Holidays (2026)',
      icon: Calendar,
      count: holidays.length,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability & Leave Management"
        subtitle="Manage employee weekly offs, leave approvals, comp-offs, and company holidays"
      >
        <Button icon={Plus} onClick={() => setIsLeaveModalOpen(true)}>
          Record Leave
        </Button>
      </PageHeader>

      {/* Tabs */}
      <Tabs tabs={tabsConfig} activeTab={activeTab} onChange={setActiveTab} />

      {/* TAB 1: LEAVES */}
      {activeTab === 'LEAVES' && (
        <div className="space-y-6">
          {/* Availability Policy Guidance */}
          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200">
            <div className="flex items-start gap-3">
              <CalendarCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-indigo-900">
                  Roster Availability & Leave Policy
                </h4>
                <p className="mt-1 text-xs text-indigo-800 leading-relaxed">
                  Only <strong>Approved</strong> leave requests are factored into automated monthly roster generation and shift allocation. Pending requests remain under review and do not block shift assignment until authorized by operations management.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">All Leave Records</h3>
              <span className="text-xs text-slate-500 font-medium">
                {leaves.length} Total Requests
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Leave Dates</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaves.map((leave) => {
                    const emp = employees.find((e) => e.id === leave.employeeId);
                    const isPending = leave.status === LEAVE_STATUS.PENDING;
                    const isApproved = leave.status === LEAVE_STATUS.APPROVED;

                    return (
                      <tr key={leave.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center">
                              {emp ? emp.avatar : 'EM'}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">
                                {emp ? emp.fullName : 'Employee'}
                              </p>
                              <p className="text-[10px] text-slate-400">{emp?.employeeId}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {formatReadableDate(leave.startDate)}
                          {leave.endDate !== leave.startDate && (
                            <span> to {formatReadableDate(leave.endDate)}</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-medium text-slate-700">
                            {leave.type}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                          {leave.reason}
                        </td>

                        <td className="py-3.5 px-4">
                          {isApproved ? (
                            <Badge variant="success" dot size="sm">
                              Approved
                            </Badge>
                          ) : isPending ? (
                            <Badge variant="warning" dot size="sm">
                              Pending Review
                            </Badge>
                          ) : (
                            <Badge variant="danger" size="sm">
                              Rejected
                            </Badge>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPending && (
                              <>
                                <Button
                                  variant="success"
                                  size="xs"
                                  onClick={() =>
                                    handleUpdateLeaveStatus(leave.id, LEAVE_STATUS.APPROVED, leave)
                                  }
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="dangerOutline"
                                  size="xs"
                                  onClick={() =>
                                    handleUpdateLeaveStatus(leave.id, LEAVE_STATUS.REJECTED, leave)
                                  }
                                >
                                  Reject
                                </Button>
                              </>
                            )}

                            {isApproved && (
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() =>
                                  handleUpdateLeaveStatus(leave.id, LEAVE_STATUS.REJECTED, leave)
                                }
                              >
                                Revoke Approval
                              </Button>
                            )}

                            {leave.status === LEAVE_STATUS.REJECTED && (
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() =>
                                  handleUpdateLeaveStatus(leave.id, LEAVE_STATUS.APPROVED, leave)
                                }
                              >
                                Re-approve
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WEEKLY OFFS */}
      {activeTab === 'WEEKLY_OFFS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Workforce Weekly Off Rules</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Baseline weekly rest days configured for each employee in the roster
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {employees.map((emp) => (
              <div
                key={emp.id}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                    {emp.avatar}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{emp.fullName}</p>
                    <p className="text-[11px] text-slate-400">{emp.employeeId}</p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded bg-slate-200 text-slate-800 font-semibold text-xs">
                  {emp.weeklyOff}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: COMP-OFFS */}
      {activeTab === 'COMP_OFFS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Compensatory Off Balances</h3>
          </div>

          <div className="divide-y divide-slate-100">
            {compOffs.map((co) => {
              const emp = employees.find((e) => e.id === co.employeeId);
              return (
                <div key={co.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center">
                      CO
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {emp ? emp.fullName : 'Employee'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Earned on {formatReadableDate(co.earnedDate)} • {co.reason}
                      </p>
                    </div>
                  </div>

                  <div>
                    {co.status === 'AVAILABLE' ? (
                      <Badge variant="success">Available to Avail</Badge>
                    ) : (
                      <Badge variant="default">Availed on {formatReadableDate(co.availedDate)}</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: PUBLIC HOLIDAYS */}
      {activeTab === 'HOLIDAYS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">National & Public Holidays (2026)</h3>
          </div>

          <div className="divide-y divide-slate-100">
            {holidays.map((hol) => (
              <div key={hol.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs flex items-center justify-center">
                    {hol.date.slice(5)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{hol.name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatReadableDate(hol.date)} • {hol.type}
                    </p>
                  </div>
                </div>

                <Badge variant={hol.isMandatory ? 'primary' : 'default'} size="sm">
                  {hol.isMandatory ? 'Mandatory National' : 'Gazetted'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leave Request Modal */}
      <LeaveRequestModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onSubmit={handleCreateLeave}
        employees={employees}
        loading={actionLoading}
      />
    </div>
  );
}

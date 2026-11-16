import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Building2,
  Layers,
  Workflow,
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  UserCheck,
  UserX,
  Coffee,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Briefcase,
} from 'lucide-react';
import { StatCard } from '../../../components/ui/StatCard';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/ui/Button';
import { PageHeader } from '../../../components/layout/PageHeader';
import { employeeService } from '../../employees/services/employeeService';
import { podService } from '../../pods/services/podService';
import { brandService } from '../../brands/services/brandService';
import { processService } from '../../processes/services/processService';
import { conflictService } from '../../conflicts/services/conflictService';
import { availabilityService } from '../../availability/services/availabilityService';
import { rosterService } from '../../roster/services/rosterService';
import { assignmentService } from '../../assignments/services/assignmentService';
import { ROSTER_STATUS } from '../../../constants/rosterStatuses';
import { formatReadableDate } from '../../../utils/dateUtils';
import { useToast } from '../../../components/common/Toast';
import { formatErrorMessage } from '../../../utils/errorHandler';

const POD_COLORS = ['bg-indigo-600', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-blue-500', 'bg-rose-500'];

export function DashboardPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalBrands: 0,
    totalPods: 0,
    totalProcesses: 0,
    workingToday: 0,
    onLeaveToday: 0,
    weeklyOffToday: 0,
    openConflicts: 0,
  });

  const [pods, setPods] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [brands, setBrands] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [upcomingLeaves, setUpcomingLeaves] = useState([]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const [
          empList,
          podList,
          brandList,
          procList,
          confList,
          leaveList,
          rosterGrid,
          asgnList,
        ] = await Promise.all([
          employeeService.getEmployees(),
          podService.getPods(),
          brandService.getBrands(),
          processService.getProcesses(),
          conflictService.getConflicts(),
          availabilityService.getLeaves(),
          rosterService.getRosterGrid(2026, 12),
          assignmentService.getAssignments(),
        ]);

        setEmployees(empList);
        setPods(podList);
        setBrands(brandList);
        setProcesses(procList);
        setConflicts(confList);
        setAssignments(asgnList);

        // Calculate "today" metrics (for December active cycle date)
        const todayDateKey = '2026-12-01';
        let workingCount = 0;
        let leaveCount = 0;
        let weeklyOffCount = 0;

        empList.forEach((emp) => {
          const dayStatus = rosterGrid[emp.id]?.[todayDateKey]?.status;
          if (dayStatus === ROSTER_STATUS.WORKING) workingCount++;
          else if (dayStatus === ROSTER_STATUS.LEAVE) leaveCount++;
          else if (dayStatus === ROSTER_STATUS.WEEKLY_OFF) weeklyOffCount++;
        });

        const openConfs = confList.filter((c) => c.status === 'OPEN');

        setStats({
          totalEmployees: empList.length,
          totalBrands: brandList.length,
          totalPods: podList.length,
          totalProcesses: procList.length,
          workingToday: workingCount,
          onLeaveToday: leaveCount,
          weeklyOffToday: weeklyOffCount,
          openConflicts: openConfs.length,
        });

        // Filter upcoming approved/pending leaves
        const futureLeaves = leaveList.slice(0, 5);
        setUpcomingLeaves(futureLeaves);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
        addToast(formatErrorMessage(err, 'Failed to load dashboard metrics'), 'error');
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  // Employee distribution by Pod
  const podDistribution = pods.map((pod) => {
    const count = employees.filter((e) => e.podId === pod.id).length;
    const percentage = Math.round((count / (employees.length || 1)) * 100);
    return {
      ...pod,
      count,
      percentage,
    };
  });

  // Calculate staffing distribution per brand from actual assignments
  const brandStaffingMap = {};
  brands.forEach((b) => {
    brandStaffingMap[b.id] = new Set();
  });
  assignments.forEach((a) => {
    if (brandStaffingMap[a.brandId]) {
      brandStaffingMap[a.brandId].add(a.employeeId);
    }
  });

  const singleStaffedBrands = brands.filter((b) => brandStaffingMap[b.id]?.size === 1);
  const multiStaffedBrands = brands.filter((b) => (brandStaffingMap[b.id]?.size || 0) > 1);

  // Multi-brand shared employees from actual assignments
  const empBrandMap = {};
  assignments.forEach((a) => {
    if (!empBrandMap[a.employeeId]) empBrandMap[a.employeeId] = new Set();
    empBrandMap[a.employeeId].add(a.brandId);
  });
  const multiBrandEmployees = employees.filter((e) => (empBrandMap[e.id]?.size || 0) > 1);

  // Workforce status
  const activeEmployees = employees.filter((e) => e.status === 'ACTIVE').length;
  const inactiveEmployees = employees.length - activeEmployees;

  // Active client brands & processes
  const activeBrands = brands.filter((b) => b.status === 'ACTIVE').length;
  const activeProcesses = processes.filter((p) => p.status === 'ACTIVE').length;

  // Open conflicts
  const openConflictsList = conflicts.filter((c) => c.status === 'OPEN');
  const topConflict = openConflictsList[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Dashboard"
        subtitle="Live oversight of workforce allocations, shift schedules, and operational health."
        badge={
          <Badge variant="primary" dot>
            December 2026 Active
          </Badge>
        }
      >
        <Button
          variant="secondary"
          size="sm"
          icon={CalendarDays}
          onClick={() => navigate('/roster')}
        >
          View Monthly Roster
        </Button>
        <Button
          variant="danger"
          size="sm"
          icon={AlertTriangle}
          onClick={() => navigate('/conflicts')}
        >
          View Conflicts ({stats.openConflicts})
        </Button>
      </PageHeader>

      {/* Critical Highlight Alert: Dynamic from real backend conflict */}
      {topConflict && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-xs">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-amber-900">
                  Critical Staffing Coverage Alert ({formatReadableDate(topConflict.date)})
                </h4>
                <p className="mt-1 text-xs text-amber-700 leading-relaxed">
                  <strong>{topConflict.brandName} • {topConflict.processName}</strong>: {topConflict.reason}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => navigate('/conflicts')}
              className="bg-white border-amber-300 text-amber-800 hover:bg-amber-100 shrink-0 ml-4"
            >
              Resolve Gaps
            </Button>
          </div>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Workforce"
          value={stats.totalEmployees}
          subtitle={`${activeEmployees} Active / ${inactiveEmployees} Inactive`}
          icon={Users}
          color="indigo"
          onClick={() => navigate('/employees')}
        />
        <StatCard
          title="Client Brands"
          value={stats.totalBrands}
          subtitle={`${activeBrands} Active Client Account${activeBrands === 1 ? '' : 's'}`}
          icon={Building2}
          color="blue"
          onClick={() => navigate('/brands')}
        />
        <StatCard
          title="Operational Pods"
          value={stats.totalPods}
          subtitle={`${pods.length} Active Operational Fleet${pods.length === 1 ? '' : 's'}`}
          icon={Layers}
          color="emerald"
          onClick={() => navigate('/pods')}
        />
        <StatCard
          title="Active Processes"
          value={stats.totalProcesses}
          subtitle={`${activeProcesses} Operational Queue${activeProcesses === 1 ? '' : 's'}`}
          icon={Workflow}
          color="purple"
          onClick={() => navigate('/processes')}
        />
      </div>

      {/* Shift Health Today */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Working Today"
          value={stats.workingToday}
          subtitle="On scheduled duty shifts"
          icon={UserCheck}
          color="emerald"
          badge={<Badge variant="success">Active Shifts</Badge>}
        />
        <StatCard
          title="Weekly Offs Today"
          value={stats.weeklyOffToday}
          subtitle="Standard scheduled rest day"
          icon={Coffee}
          color="slate"
          badge={<Badge variant="default">Rest Day</Badge>}
        />
        <StatCard
          title="On Approved Leave"
          value={stats.onLeaveToday}
          subtitle="Planned & approved absences"
          icon={UserX}
          color="amber"
          badge={<Badge variant="warning">Leave</Badge>}
        />
      </div>

      {/* Two Column Layout: Pod Distribution & Brand Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pod Distribution Card */}
        <Card
          title="Workforce Distribution by Pod"
          subtitle="Headcount allocation across operational focus areas"
          action={
            <Button
              variant="ghost"
              size="xs"
              onClick={() => navigate('/pods')}
              icon={ArrowRight}
              iconPosition="right"
            >
              View Pods
            </Button>
          }
        >
          {podDistribution.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No operational pods configured.
            </div>
          ) : (
            <div className="space-y-4">
              {podDistribution.map((pod, idx) => (
                <div key={pod.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{pod.name}</span>
                    <span className="text-slate-500 font-medium">
                      {pod.count} employee{pod.count === 1 ? '' : 's'} ({pod.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        POD_COLORS[idx % POD_COLORS.length]
                      }`}
                      style={{ width: `${pod.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Brand Staffing Architecture */}
        <Card
          title="Brand Staffing Model Overview"
          subtitle="Adherence to assignment staffing distribution criteria"
          action={
            <Button
              variant="ghost"
              size="xs"
              onClick={() => navigate('/assignments')}
              icon={ArrowRight}
              iconPosition="right"
            >
              Assignments
            </Button>
          }
        >
          {brands.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No client brands registered.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Dedicated 1-Person Staffed Brands
                  </span>
                  <Badge variant="success">
                    {singleStaffedBrands.length} Brand{singleStaffedBrands.length === 1 ? '' : 's'} ({brands.length ? Math.round((singleStaffedBrands.length / brands.length) * 100) : 0}%)
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {singleStaffedBrands.length > 0
                    ? singleStaffedBrands.map((b) => b.name).join(', ')
                    : 'No single-staffed brands assigned.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Multi-Person Staffed Brands
                  </span>
                  <Badge variant="info">
                    {multiStaffedBrands.length} Brand{multiStaffedBrands.length === 1 ? '' : 's'} ({brands.length ? Math.round((multiStaffedBrands.length / brands.length) * 100) : 0}%)
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {multiStaffedBrands.length > 0
                    ? multiStaffedBrands.map((b) => b.name).join(', ')
                    : 'No multi-staffed brands configured.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Multi-Brand Shared Employees
                  </span>
                  <Badge variant="purple">
                    {multiBrandEmployees.length} Employee{multiBrandEmployees.length === 1 ? '' : 's'}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {multiBrandEmployees.length > 0
                    ? multiBrandEmployees.map((e) => e.fullName).join(', ')
                    : 'All assigned employees currently dedicated to single accounts.'}
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Two Column Layout: Upcoming Leaves & Critical Coverage Conflicts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Leaves */}
        <Card
          title="Recent & Upcoming Leaves"
          subtitle="Planned absences awaiting or granted operational clearance"
          action={
            <Button
              variant="ghost"
              size="xs"
              onClick={() => navigate('/availability')}
              icon={ArrowRight}
              iconPosition="right"
            >
              Availability
            </Button>
          }
        >
          {upcomingLeaves.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No upcoming leaves scheduled.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingLeaves.map((leave) => {
                const emp = employees.find((e) => e.id === leave.employeeId);
                return (
                  <div key={leave.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center">
                        {emp ? emp.avatar : 'EM'}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-800">
                          {emp ? emp.fullName : 'Employee'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {leave.type} • {formatReadableDate(leave.startDate)}
                        </p>
                      </div>
                    </div>
                    <div>
                      {leave.status === 'APPROVED' ? (
                        <Badge variant="success" dot size="sm">
                          Approved
                        </Badge>
                      ) : leave.status === 'PENDING' ? (
                        <Badge variant="warning" dot size="sm">
                          Pending
                        </Badge>
                      ) : (
                        <Badge variant="danger" size="sm">
                          Rejected
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Live Scheduling Conflicts */}
        <Card
          title="Top Scheduling Conflicts"
          subtitle="Active coverage shortfalls & rule discrepancies"
          action={
            <Button
              variant="ghost"
              size="xs"
              onClick={() => navigate('/conflicts')}
              icon={ArrowRight}
              iconPosition="right"
            >
              All Conflicts
            </Button>
          }
        >
          {openConflictsList.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5 opacity-80" />
              No active coverage conflicts. All operational rules satisfied.
            </div>
          ) : (
            <div className="space-y-3">
              {openConflictsList.slice(0, 3).map((conf) => (
                <div
                  key={conf.id}
                  className="p-3 rounded-lg border border-rose-100 bg-rose-50/50 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-rose-950">
                          {conf.brandName} • {conf.processName}
                        </span>
                        <Badge variant="danger" size="sm">
                          {conf.severity}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-600 leading-snug">
                        {conf.reason}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400 font-medium">
                        Target Date: {formatReadableDate(conf.date)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => navigate('/conflicts')}
                    className="shrink-0 bg-white"
                  >
                    Resolve
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

import { supabase } from '../../config/supabase.js';

class DashboardService {
  async getMetrics() {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    // Query counts in parallel
    const [
      { count: totalEmployees },
      { count: activeEmployees },
      { count: inactiveEmployees },
      { count: totalPods },
      { count: totalBrands },
      { count: totalProcesses },
      { count: totalAssignments },
      { count: pendingLeaves },
      { count: pendingCompOffs },
      { data: currentRosters },
      { data: openConflicts },
    ] = await Promise.all([
      supabase.from('employees').select('id', { count: 'exact', head: true }),
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('employment_status', 'ACTIVE'),
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('employment_status', 'INACTIVE'),
      supabase.from('pods').select('id', { count: 'exact', head: true }),
      supabase.from('brands').select('id', { count: 'exact', head: true }),
      supabase.from('processes').select('id', { count: 'exact', head: true }),
      supabase.from('employee_assignments').select('id', { count: 'exact', head: true }),
      supabase.from('leaves').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabase.from('comp_offs').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabase.from('rosters').select('id, status, month, year').eq('month', currentMonth).eq('year', currentYear).limit(1),
      supabase.from('roster_conflicts').select('id, severity, conflict_type').eq('status', 'OPEN'),
    ]);

    const conflicts = openConflicts || [];
    const criticalConflicts = conflicts.filter((c) => c.severity === 'CRITICAL').length;
    const warningConflicts = conflicts.filter((c) => c.severity === 'WARNING').length;
    const infoConflicts = conflicts.filter((c) => c.severity === 'INFO').length;

    const currentRoster = currentRosters && currentRosters.length > 0 ? currentRosters[0] : null;

    return {
      employees: {
        total: totalEmployees || 0,
        active: activeEmployees || 0,
        inactive: inactiveEmployees || 0,
      },
      organization: {
        pods_count: totalPods || 0,
        brands_count: totalBrands || 0,
        processes_count: totalProcesses || 0,
        assignments_count: totalAssignments || 0,
      },
      availability: {
        pending_leaves_count: pendingLeaves || 0,
        pending_comp_offs_count: pendingCompOffs || 0,
      },
      roster: {
        current_month: currentMonth,
        current_year: currentYear,
        roster_id: currentRoster?.id || null,
        status: currentRoster?.status || 'NOT_GENERATED',
      },
      conflicts: {
        total_open: conflicts.length,
        critical: criticalConflicts,
        warning: warningConflicts,
        info: infoConflicts,
      },
    };
  }

  async getOverview() {
    const metrics = await this.getMetrics();

    // Fetch pods with lead employee
    const { data: pods } = await supabase
      .from('pods')
      .select('id, name, description, lead_employee:employees!pods_lead_employee_id_fkey(id, full_name)')
      .limit(10);

    // Fetch recent open conflicts
    const { data: recentConflicts } = await supabase
      .from('roster_conflicts')
      .select('id, conflict_type, severity, conflict_date, description, brand:brands(name), process:processes(name)')
      .eq('status', 'OPEN')
      .order('created_at', { ascending: false })
      .limit(5);

    return {
      metrics,
      pods: pods || [],
      recent_conflicts: recentConflicts || [],
    };
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;

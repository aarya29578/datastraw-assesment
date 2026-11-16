import { supabase } from '../../config/supabase.js';

/**
 * Availability Repository
 * Handles direct Supabase database operations for weekly_offs, leaves, comp_offs, and public_holidays.
 */
class AvailabilityRepository {
  // ==========================================
  // 1. Weekly Offs
  // ==========================================
  async createWeeklyOff(data) {
    const { data: record, error } = await supabase
      .from('weekly_offs')
      .insert([data])
      .select('*, employee:employees(id, employee_code, full_name, designation, pod_id)')
      .single();
    return { data: record, error };
  }

  async findWeeklyOffs({ page = 1, limit = 50, employee_id, pod_id, is_active, target_date }) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('weekly_offs')
      .select('*, employee:employees!inner(id, employee_code, full_name, designation, pod_id, employment_status)', { count: 'exact' });

    if (employee_id) query = query.eq('employee_id', employee_id);
    if (pod_id) query = query.eq('employee.pod_id', pod_id);
    if (is_active !== undefined && is_active !== null) query = query.eq('is_active', is_active);
    if (target_date) {
      query = query
        .lte('effective_from', target_date)
        .or(`effective_to.is.null,effective_to.gte.${target_date}`);
    }

    query = query.order('created_at', { ascending: false }).range(from, to);
    const { data, count, error } = await query;
    return { data: data || [], count: count || 0, error };
  }

  async findWeeklyOffById(id) {
    const { data, error } = await supabase
      .from('weekly_offs')
      .select('*, employee:employees(id, employee_code, full_name, designation, pod_id)')
      .eq('id', id)
      .maybeSingle();
    return { data, error };
  }

  async updateWeeklyOff(id, updateData) {
    const { data, error } = await supabase
      .from('weekly_offs')
      .update(updateData)
      .eq('id', id)
      .select('*, employee:employees(id, employee_code, full_name, designation, pod_id)')
      .single();
    return { data, error };
  }

  async deleteWeeklyOff(id) {
    const { data, error } = await supabase
      .from('weekly_offs')
      .delete()
      .eq('id', id)
      .select()
      .maybeSingle();
    return { data, error };
  }

  // ==========================================
  // 2. Leaves
  // ==========================================
  async createLeave(data) {
    const { data: record, error } = await supabase
      .from('leaves')
      .insert([data])
      .select('*, employee:employees!leaves_employee_id_fkey(id, employee_code, full_name, designation, pod_id), approver:employees!leaves_approved_by_fkey(id, full_name)')
      .single();
    return { data: record, error };
  }

  async findLeaves({ page = 1, limit = 50, employee_id, pod_id, status, start_date, end_date }) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('leaves')
      .select('*, employee:employees!leaves_employee_id_fkey!inner(id, employee_code, full_name, designation, pod_id), approver:employees!leaves_approved_by_fkey(id, full_name)', { count: 'exact' });

    if (employee_id) query = query.eq('employee_id', employee_id);
    if (pod_id) query = query.eq('employee.pod_id', pod_id);
    if (status) query = query.eq('status', status);
    if (start_date) query = query.gte('end_date', start_date);
    if (end_date) query = query.lte('start_date', end_date);

    query = query.order('start_date', { ascending: false }).range(from, to);
    const { data, count, error } = await query;
    return { data: data || [], count: count || 0, error };
  }

  async findLeaveById(id) {
    const { data, error } = await supabase
      .from('leaves')
      .select('*, employee:employees!leaves_employee_id_fkey(id, employee_code, full_name, designation, pod_id), approver:employees!leaves_approved_by_fkey(id, full_name)')
      .eq('id', id)
      .maybeSingle();
    return { data, error };
  }

  async updateLeave(id, updateData) {
    const { data, error } = await supabase
      .from('leaves')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, employee:employees!leaves_employee_id_fkey(id, employee_code, full_name, designation, pod_id), approver:employees!leaves_approved_by_fkey(id, full_name)')
      .single();
    return { data, error };
  }

  // ==========================================
  // 3. Comp-Offs
  // ==========================================
  async createCompOff(data) {
    const { data: record, error } = await supabase
      .from('comp_offs')
      .insert([data])
      .select('*, employee:employees!comp_offs_employee_id_fkey(id, employee_code, full_name, designation, pod_id), approver:employees!comp_offs_approved_by_fkey(id, full_name)')
      .single();
    return { data: record, error };
  }

  async findCompOffs({ page = 1, limit = 50, employee_id, pod_id, status, target_date }) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('comp_offs')
      .select('*, employee:employees!comp_offs_employee_id_fkey!inner(id, employee_code, full_name, designation, pod_id), approver:employees!comp_offs_approved_by_fkey(id, full_name)', { count: 'exact' });

    if (employee_id) query = query.eq('employee_id', employee_id);
    if (pod_id) query = query.eq('employee.pod_id', pod_id);
    if (status) query = query.eq('status', status);
    if (target_date) query = query.eq('off_date', target_date);

    query = query.order('off_date', { ascending: false }).range(from, to);
    const { data, count, error } = await query;
    return { data: data || [], count: count || 0, error };
  }

  async findCompOffById(id) {
    const { data, error } = await supabase
      .from('comp_offs')
      .select('*, employee:employees!comp_offs_employee_id_fkey(id, employee_code, full_name, designation, pod_id), approver:employees!comp_offs_approved_by_fkey(id, full_name)')
      .eq('id', id)
      .maybeSingle();
    return { data, error };
  }

  async updateCompOff(id, updateData) {
    const { data, error } = await supabase
      .from('comp_offs')
      .update(updateData)
      .eq('id', id)
      .select('*, employee:employees!comp_offs_employee_id_fkey(id, employee_code, full_name, designation, pod_id), approver:employees!comp_offs_approved_by_fkey(id, full_name)')
      .single();
    return { data, error };
  }

  // ==========================================
  // 4. Public Holidays
  // ==========================================
  async createHoliday(data) {
    const { data: record, error } = await supabase
      .from('public_holidays')
      .insert([data])
      .select()
      .single();
    return { data: record, error };
  }

  async findHolidays({ page = 1, limit = 100, year, is_active }) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('public_holidays')
      .select('*', { count: 'exact' });

    if (year) {
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;
      query = query.gte('holiday_date', startOfYear).lte('holiday_date', endOfYear);
    }
    if (is_active !== undefined && is_active !== null) {
      query = query.eq('is_active', is_active);
    }

    query = query.order('holiday_date', { ascending: true }).range(from, to);
    const { data, count, error } = await query;
    return { data: data || [], count: count || 0, error };
  }

  async findHolidayById(id) {
    const { data, error } = await supabase
      .from('public_holidays')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return { data, error };
  }

  async findHolidayByDate(date) {
    const { data, error } = await supabase
      .from('public_holidays')
      .select('*')
      .eq('holiday_date', date)
      .maybeSingle();
    return { data, error };
  }

  async updateHoliday(id, updateData) {
    const { data, error } = await supabase
      .from('public_holidays')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  }

  async deleteHoliday(id) {
    const { data, error } = await supabase
      .from('public_holidays')
      .delete()
      .eq('id', id)
      .select()
      .maybeSingle();
    return { data, error };
  }

  // General helper
  async checkEmployeeExists(employeeId) {
    const { data, error } = await supabase
      .from('employees')
      .select('id, full_name, employment_status')
      .eq('id', employeeId)
      .maybeSingle();
    return { data, error };
  }
}

export const availabilityRepository = new AvailabilityRepository();
export default availabilityRepository;

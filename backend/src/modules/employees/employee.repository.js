import { supabase } from '../../config/supabase.js';

/**
 * Employee Repository
 * Handles all direct Supabase database interactions for the employees table.
 */
class EmployeeRepository {
  /**
   * Insert a new employee record
   * @param {Object} employeeData
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async create(employeeData) {
    const { data, error } = await supabase
      .from('employees')
      .insert([employeeData])
      .select('*, pod:pods!employees_pod_id_fkey(*), weekly_offs:weekly_offs(*)')
      .single();

    return { data, error };
  }

  /**
   * Retrieve employees with optional search, filtering, and pagination
   * @param {Object} queryOptions
   * @returns {Promise<{ data: Array, count: number, error: Object }>}
   */
  async findAll({ page = 1, limit = 10, search, pod_id, employment_status }) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('employees')
      .select('*, pod:pods!employees_pod_id_fkey(*), weekly_offs:weekly_offs(*)', { count: 'exact' });

    // Text search on full_name, employee_code, or email
    if (search && search.trim() !== '') {
      const sanitized = search.trim();
      query = query.or(
        `full_name.ilike.%${sanitized}%,employee_code.ilike.%${sanitized}%,email.ilike.%${sanitized}%`
      );
    }

    // Filter by pod_id
    if (pod_id) {
      query = query.eq('pod_id', pod_id);
    }

    // Filter by employment_status
    if (employment_status) {
      query = query.eq('employment_status', employment_status);
    }

    // Sort by created_at descending and paginate
    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;
    return { data: data || [], count: count || 0, error };
  }

  /**
   * Find an employee by primary key UUID
   * @param {string} id
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async findById(id) {
    const { data, error } = await supabase
      .from('employees')
      .select('*, pod:pods!employees_pod_id_fkey(*), weekly_offs:weekly_offs(*)')
      .eq('id', id)
      .maybeSingle();

    return { data, error };
  }

  /**
   * Find an employee by unique employee_code
   * @param {string} employeeCode
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async findByCode(employeeCode) {
    const { data, error } = await supabase
      .from('employees')
      .select('id, employee_code')
      .eq('employee_code', employeeCode)
      .maybeSingle();

    return { data, error };
  }

  /**
   * Find an employee by unique email
   * @param {string} email
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async findByEmail(email) {
    const { data, error } = await supabase
      .from('employees')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    return { data, error };
  }

  /**
   * Update an employee by ID
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async update(id, updateData) {
    const { data, error } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', id)
      .select('*, pod:pods!employees_pod_id_fkey(*), weekly_offs:weekly_offs(*)')
      .single();

    return { data, error };
  }

  /**
   * Upsert or update an employee's weekly off day in the weekly_offs table
   * @param {string} employeeId
   * @param {number} weekday (0 = Sun, 1 = Mon, ..., 6 = Sat)
   * @param {string} effectiveFrom
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async upsertWeeklyOff(employeeId, weekday, effectiveFrom = '2026-11-01') {
    const { data: existing, error: checkError } = await supabase
      .from('weekly_offs')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('is_active', true);

    if (checkError) return { data: null, error: checkError };

    if (existing && existing.length > 0) {
      const { data, error } = await supabase
        .from('weekly_offs')
        .update({
          weekday,
          effective_from: effectiveFrom,
          is_active: true,
        })
        .eq('employee_id', employeeId)
        .eq('is_active', true)
        .select();

      return { data: data?.[0] || null, error };
    } else {
      const { data, error } = await supabase
        .from('weekly_offs')
        .insert({
          employee_id: employeeId,
          weekday,
          effective_from: effectiveFrom,
          effective_to: null,
          is_active: true,
        })
        .select()
        .single();

      return { data, error };
    }
  }

  /**
   * Verify if a pod exists in the pods table
   * @param {string} podId
   * @returns {Promise<boolean>}
   */
  async checkPodExists(podId) {
    const { data, error } = await supabase
      .from('pods')
      .select('id')
      .eq('id', podId)
      .maybeSingle();

    if (error || !data) return false;
    return true;
  }

  /**
   * Clear lead_employee_id on any pods where this employee was lead if not matching newPodId
   * @param {string} employeeId
   * @param {string|null} newPodId
   * @returns {Promise<{ success: boolean }>}
   */
  async clearLeadingPodsIfNotMatching(employeeId, newPodId) {
    const { data: leadingPods } = await supabase
      .from('pods')
      .select('id')
      .eq('lead_employee_id', employeeId);

    if (leadingPods && leadingPods.length > 0) {
      for (const p of leadingPods) {
        if (!newPodId || p.id !== newPodId) {
          await supabase.from('pods').update({ lead_employee_id: null }).eq('id', p.id);
        }
      }
    }
    return { success: true };
  }

  /**
   * Count historical schedule and workflow records referencing an employee
   * @param {string} employeeId
   * @returns {Promise<{ assignmentCount: number, rosterCount: number, leaveCount: number }>}
   */
  async countHistoricalRecords(employeeId) {
    // 1. Check assignments
    const { data: assignments } = await supabase
      .from('employee_assignments')
      .select('id')
      .eq('employee_id', employeeId);

    const assignmentCount = assignments?.length || 0;

    // 2. Check roster entries linked to this employee's assignments
    let rosterCount = 0;
    if (assignmentCount > 0) {
      const asgnIds = assignments.map((a) => a.id);
      const { count } = await supabase
        .from('roster_entries')
        .select('id', { count: 'exact', head: true })
        .in('assignment_id', asgnIds);

      rosterCount = count || 0;
    }

    // 3. Check leaves
    const { count: leaveCount } = await supabase
      .from('leaves')
      .select('id', { count: 'exact', head: true })
      .eq('employee_id', employeeId);

    return {
      assignmentCount,
      rosterCount,
      leaveCount: leaveCount || 0,
    };
  }

  /**
   * Permanently delete an employee and clean up non-historical availability constraints
   * @param {string} employeeId
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async deletePermanently(employeeId) {
    // 1. Clear Pod lead if this employee leads any pod
    await supabase.from('pods').update({ lead_employee_id: null }).eq('lead_employee_id', employeeId);

    // 2. Clean up any default weekly off records
    await supabase.from('weekly_offs').delete().eq('employee_id', employeeId);

    // 3. Delete employee record
    const { data, error } = await supabase
      .from('employees')
      .delete()
      .eq('id', employeeId)
      .select()
      .maybeSingle();

    return { data, error };
  }
}

export const employeeRepository = new EmployeeRepository();
export default employeeRepository;

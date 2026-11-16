import { supabase } from '../../config/supabase.js';

const POD_RELATIONS_SELECT =
  '*, lead_employee:employees!pods_lead_employee_id_fkey(id, employee_code, full_name, email, designation), employees:employees!employees_pod_id_fkey(id, employee_code, full_name, designation, employment_status, employee_assignments(id, is_primary, brand:brands(id, name, status), process:processes(id, code, name, status)))';

/**
 * Pod Repository
 * Handles all direct Supabase database interactions for the pods table.
 */
class PodRepository {
  /**
   * Insert a new pod record
   * @param {Object} podData
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async create(podData) {
    const { data, error } = await supabase
      .from('pods')
      .insert([podData])
      .select(POD_RELATIONS_SELECT)
      .single();

    return { data, error };
  }

  /**
   * Retrieve pods with optional search and pagination
   * @param {Object} queryOptions
   * @returns {Promise<{ data: Array, count: number, error: Object }>}
   */
  async findAll({ page = 1, limit = 10, search }) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('pods')
      .select(POD_RELATIONS_SELECT, { count: 'exact' });

    // Text search on name or description
    if (search && search.trim() !== '') {
      const sanitized = search.trim();
      query = query.or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
    }

    // Sort by created_at descending and paginate
    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;
    return { data: data || [], count: count || 0, error };
  }

  /**
   * Find a pod by primary key UUID
   * @param {string} id
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async findById(id) {
    const { data, error } = await supabase
      .from('pods')
      .select(POD_RELATIONS_SELECT)
      .eq('id', id)
      .maybeSingle();

    return { data, error };
  }

  /**
   * Find a pod by name (case-insensitive)
   * @param {string} name
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async findByName(name) {
    const { data, error } = await supabase
      .from('pods')
      .select('id, name')
      .ilike('name', name)
      .maybeSingle();

    return { data, error };
  }

  /**
   * Update a pod by ID
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async update(id, updateData) {
    const { data, error } = await supabase
      .from('pods')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(POD_RELATIONS_SELECT)
      .single();

    return { data, error };
  }

  /**
   * Delete a pod by ID
   * @param {string} id
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async delete(id) {
    const { data, error } = await supabase
      .from('pods')
      .delete()
      .eq('id', id)
      .select()
      .maybeSingle();

    return { data, error };
  }

  /**
   * Check if any employees are currently assigned to this pod
   * @param {string} podId
   * @returns {Promise<number>}
   */
  async countAssignedEmployees(podId) {
    const { count, error } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('pod_id', podId);

    if (error) return 0;
    return count || 0;
  }

  /**
   * Count active employees currently assigned to this pod
   * @param {string} podId
   * @returns {Promise<number>}
   */
  async countActiveEmployees(podId) {
    const { count, error } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('pod_id', podId)
      .eq('employment_status', 'ACTIVE');

    if (error) return 0;
    return count || 0;
  }

  /**
   * Safely unassign all inactive employees from a pod before deletion
   * Sets their pod_id to null while preserving employee records and historical rosters
   * @param {string} podId
   * @returns {Promise<{ error: Object }>}
   */
  async unassignInactiveEmployees(podId) {
    const { error } = await supabase
      .from('employees')
      .update({ pod_id: null })
      .eq('pod_id', podId)
      .eq('employment_status', 'INACTIVE');

    return { error };
  }

  /**
   * Clear lead employee reference on a pod
   * @param {string} podId
   * @returns {Promise<{ error: Object }>}
   */
  async clearPodLead(podId) {
    const { error } = await supabase
      .from('pods')
      .update({ lead_employee_id: null })
      .eq('id', podId);

    return { error };
  }

  /**
   * Verify if an employee exists in the employees table and get their status
   * @param {string} employeeId
   * @returns {Promise<{ exists: boolean, employee: Object }>}
   */
  async checkEmployeeExists(employeeId) {
    const { data, error } = await supabase
      .from('employees')
      .select('id, full_name, employment_status')
      .eq('id', employeeId)
      .maybeSingle();

    if (error || !data) {
      return { exists: false, employee: null };
    }
    return { exists: true, employee: data };
  }

  /**
   * Assign an employee to a pod by updating employees.pod_id
   * @param {string} employeeId
   * @param {string} podId
   * @returns {Promise<{ error: Object }>}
   */
  async assignEmployeeToPod(employeeId, podId) {
    const { error } = await supabase
      .from('employees')
      .update({ pod_id: podId })
      .eq('id', employeeId);

    return { error };
  }

  /**
   * Clear lead_employee_id on other pods this employee leads
   * @param {string} employeeId
   * @param {string} excludePodId
   * @returns {Promise<{ error: Object }>}
   */
  async clearOtherPodLeads(employeeId, excludePodId) {
    let query = supabase
      .from('pods')
      .update({ lead_employee_id: null })
      .eq('lead_employee_id', employeeId);

    if (excludePodId) {
      query = query.neq('id', excludePodId);
    }

    const { error } = await query;
    return { error };
  }
}

export const podRepository = new PodRepository();
export default podRepository;

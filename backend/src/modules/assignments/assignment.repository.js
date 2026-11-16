import { supabase } from '../../config/supabase.js';

/**
 * Assignment Repository
 * Handles Supabase database interactions for the employee_assignments table.
 */
class AssignmentRepository {
  /**
   * Insert a single assignment record
   * @param {Object} assignmentData
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async create(assignmentData) {
    const { data, error } = await supabase
      .from('employee_assignments')
      .insert([assignmentData])
      .select(`
        *,
        employee:employees(id, employee_code, full_name, designation, pod_id, employment_status),
        brand:brands(id, name, status),
        process:processes(id, code, name, status)
      `)
      .single();

    return { data, error };
  }

  /**
   * Bulk insert multiple assignment records (for multi-process fan-out)
   * @param {Array<Object>} assignmentsData
   * @returns {Promise<{ data: Array, error: Object }>}
   */
  async createBulk(assignmentsData) {
    const { data, error } = await supabase
      .from('employee_assignments')
      .insert(assignmentsData)
      .select(`
        *,
        employee:employees(id, employee_code, full_name, designation, pod_id, employment_status),
        brand:brands(id, name, status),
        process:processes(id, code, name, status)
      `);

    return { data, error };
  }

  /**
   * Retrieve assignments with filtering, search, and pagination
   * @param {Object} queryOptions
   * @returns {Promise<{ data: Array, count: number, error: Object }>}
   */
  async findAll({ page = 1, limit = 10, employee_id, brand_id, process_id, pod_id, search }) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('employee_assignments')
      .select(`
        *,
        employee:employees!inner(id, employee_code, full_name, designation, pod_id, employment_status),
        brand:brands(id, name, status),
        process:processes(id, code, name, status)
      `, { count: 'exact' });

    if (employee_id) {
      query = query.eq('employee_id', employee_id);
    }
    if (brand_id) {
      query = query.eq('brand_id', brand_id);
    }
    if (process_id) {
      query = query.eq('process_id', process_id);
    }
    if (pod_id) {
      query = query.eq('employee.pod_id', pod_id);
    }

    if (search && search.trim() !== '') {
      const sanitized = search.trim();
      query = query.or(`employee.full_name.ilike.%${sanitized}%,employee.employee_code.ilike.%${sanitized}%`);
    }

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;
    return { data: data || [], count: count || 0, error };
  }

  /**
   * Find an assignment by ID
   * @param {string} id
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async findById(id) {
    const { data, error } = await supabase
      .from('employee_assignments')
      .select(`
        *,
        employee:employees(id, employee_code, full_name, designation, pod_id, employment_status),
        brand:brands(id, name, status),
        process:processes(id, code, name, status)
      `)
      .eq('id', id)
      .maybeSingle();

    return { data, error };
  }

  /**
   * Find existing assignment for employee, brand, and process
   * @param {string} employeeId
   * @param {string} brandId
   * @param {string} processId
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async findExisting(employeeId, brandId, processId) {
    const { data, error } = await supabase
      .from('employee_assignments')
      .select('id, employee_id, brand_id, process_id')
      .eq('employee_id', employeeId)
      .eq('brand_id', brandId)
      .eq('process_id', processId)
      .maybeSingle();

    return { data, error };
  }

  /**
   * Update an assignment by ID
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async update(id, updateData) {
    const { data, error } = await supabase
      .from('employee_assignments')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        employee:employees(id, employee_code, full_name, designation, pod_id, employment_status),
        brand:brands(id, name, status),
        process:processes(id, code, name, status)
      `)
      .single();

    return { data, error };
  }

  /**
   * Delete an assignment by ID
   * @param {string} id
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async delete(id) {
    const { data, error } = await supabase
      .from('employee_assignments')
      .delete()
      .eq('id', id)
      .select()
      .maybeSingle();

    return { data, error };
  }

  /**
   * Count roster entries referencing this assignment
   * @param {string} assignmentId
   * @returns {Promise<number>}
   */
  async countRosterEntries(assignmentId) {
    const { count, error } = await supabase
      .from('roster_entries')
      .select('id', { count: 'exact', head: true })
      .eq('assignment_id', assignmentId);

    if (error) return 0;
    return count || 0;
  }

  /**
   * Check employee validity
   * @param {string} employeeId
   */
  async getEmployee(employeeId) {
    const { data, error } = await supabase
      .from('employees')
      .select('id, full_name, employment_status')
      .eq('id', employeeId)
      .maybeSingle();

    return { data, error };
  }

  /**
   * Check brand validity
   * @param {string} brandId
   */
  async getBrand(brandId) {
    const { data, error } = await supabase
      .from('brands')
      .select('id, name, status')
      .eq('id', brandId)
      .maybeSingle();

    return { data, error };
  }

  /**
   * Check process validity
   * @param {string} processId
   */
  async getProcess(processId) {
    const { data, error } = await supabase
      .from('processes')
      .select('id, name, code, status')
      .eq('id', processId)
      .maybeSingle();

    return { data, error };
  }
}

export const assignmentRepository = new AssignmentRepository();
export default assignmentRepository;

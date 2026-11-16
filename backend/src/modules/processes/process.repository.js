import { supabase } from '../../config/supabase.js';

/**
 * Process Repository
 * Handles all direct Supabase database interactions for the processes table.
 */
class ProcessRepository {
  /**
   * Insert a new process record
   * @param {Object} processData
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async create(processData) {
    const { data, error } = await supabase
      .from('processes')
      .insert([processData])
      .select('*, working_rules(id, brand_id, required_staff_count, is_active)')
      .single();

    return { data, error };
  }

  /**
   * Retrieve processes with optional search, status filtering, and pagination
   * @param {Object} queryOptions
   * @returns {Promise<{ data: Array, count: number, error: Object }>}
   */
  async findAll({ page = 1, limit = 10, search, status }) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('processes')
      .select('*, working_rules(id, brand_id, required_staff_count, is_active)', { count: 'exact' });

    // Text search on code, name, or description
    if (search && search.trim() !== '') {
      const sanitized = search.trim();
      query = query.or(`code.ilike.%${sanitized}%,name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
    }

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }

    // Sort by created_at descending and paginate
    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;
    return { data: data || [], count: count || 0, error };
  }

  /**
   * Find a process by primary key UUID
   * @param {string} id
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async findById(id) {
    const { data, error } = await supabase
      .from('processes')
      .select('*, working_rules(id, brand_id, required_staff_count, is_active)')
      .eq('id', id)
      .maybeSingle();

    return { data, error };
  }

  /**
   * Find a process by unique code (case-insensitive)
   * @param {string} code
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async findByCode(code) {
    const { data, error } = await supabase
      .from('processes')
      .select('id, code, name, status')
      .ilike('code', code)
      .maybeSingle();

    return { data, error };
  }

  /**
   * Update a process by ID
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async update(id, updateData) {
    const { data, error } = await supabase
      .from('processes')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, working_rules(id, brand_id, required_staff_count, is_active)')
      .single();

    return { data, error };
  }

  /**
   * Check if a brand exists in the brands table
   * @param {string} brandId
   * @returns {Promise<boolean>}
   */
  async checkBrandExists(brandId) {
    const { data, error } = await supabase
      .from('brands')
      .select('id')
      .eq('id', brandId)
      .maybeSingle();

    if (error || !data) return false;
    return true;
  }

  /**
   * Count active employee assignments referencing this process
   * @param {string} processId
   * @returns {Promise<number>}
   */
  async countActiveAssignments(processId) {
    const { count, error } = await supabase
      .from('employee_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('process_id', processId);

    if (error) return 0;
    return count || 0;
  }

  /**
   * Count active working rules referencing this process
   * @param {string} processId
   * @returns {Promise<number>}
   */
  async countActiveWorkingRules(processId) {
    const { count, error } = await supabase
      .from('working_rules')
      .select('id', { count: 'exact', head: true })
      .eq('process_id', processId)
      .eq('is_active', true);

    if (error) return 0;
    return count || 0;
  }
  /**
   * Permanently delete a process record by ID
   * @param {string} id
   * @returns {Promise<{ error: Object }>}
   */
  async delete(id) {
    const { error } = await supabase
      .from('processes')
      .delete()
      .eq('id', id);

    return { error };
  }
}

export const processRepository = new ProcessRepository();
export default processRepository;

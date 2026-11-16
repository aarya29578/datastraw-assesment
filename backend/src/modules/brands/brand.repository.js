import { supabase } from '../../config/supabase.js';

const BRAND_RELATIONS_SELECT =
  '*, working_rules(id, process_id, required_staff_count, is_active), ' +
  'employee_assignments(id, is_primary, process_id, employee:employees(id, full_name, pod_id, employment_status, pod:pods!employees_pod_id_fkey(id, name)))';

/**
 * Brand Repository
 * Handles all direct Supabase database interactions for the brands table.
 */
class BrandRepository {
  /**
   * Insert a new brand record
   * @param {Object} brandData
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async create(brandData) {
    const { data, error } = await supabase
      .from('brands')
      .insert([brandData])
      .select(BRAND_RELATIONS_SELECT)
      .single();

    return { data, error };
  }

  /**
   * Retrieve brands with optional search, status filtering, and pagination
   * @param {Object} queryOptions
   * @returns {Promise<{ data: Array, count: number, error: Object }>}
   */
  async findAll({ page = 1, limit = 10, search, status }) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('brands')
      .select(BRAND_RELATIONS_SELECT, { count: 'exact' });

    // Text search on name or description
    if (search && search.trim() !== '') {
      const sanitized = search.trim();
      query = query.or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
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
   * Find a brand by primary key UUID
   * @param {string} id
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async findById(id) {
    const { data, error } = await supabase
      .from('brands')
      .select(BRAND_RELATIONS_SELECT)
      .eq('id', id)
      .maybeSingle();

    return { data, error };
  }

  /**
   * Find a brand by exact name (case-insensitive)
   * @param {string} name
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async findByName(name) {
    const { data, error } = await supabase
      .from('brands')
      .select('id, name, status')
      .ilike('name', name)
      .maybeSingle();

    return { data, error };
  }

  /**
   * Update a brand by ID
   * @param {string} id
   * @param {Object} updateData
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async update(id, updateData) {
    const { data, error } = await supabase
      .from('brands')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(BRAND_RELATIONS_SELECT)
      .single();

    return { data, error };
  }

  /**
   * Check if a pod exists in the pods table
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
   * Retrieve a pod record by ID
   * @param {string} podId
   * @returns {Promise<{ data: Object, error: Object }>}
   */
  async findPodById(podId) {
    const { data, error } = await supabase
      .from('pods')
      .select('id, name, description')
      .eq('id', podId)
      .maybeSingle();

    return { data, error };
  }

  /**
   * Count active employee assignments referencing this brand
   * @param {string} brandId
   * @returns {Promise<number>}
   */
  async countActiveAssignments(brandId) {
    const { count, error } = await supabase
      .from('employee_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId);

    if (error) return 0;
    return count || 0;
  }

  /**
   * Count active working rules referencing this brand
   * @param {string} brandId
   * @returns {Promise<number>}
   */
  async countActiveWorkingRules(brandId) {
    const { count, error } = await supabase
      .from('working_rules')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('is_active', true);

    if (error) return 0;
    return count || 0;
  }

  /**
   * Check if a process exists in the processes table
   * @param {string} processId
   * @returns {Promise<Object|null>}
   */
  async checkProcessExists(processId) {
    const { data, error } = await supabase
      .from('processes')
      .select('id, name, code, status')
      .eq('id', processId)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  }

  /**
   * Retrieve multiple process records by array of UUIDs
   * @param {string[]} processIds
   * @returns {Promise<{ data: Array, error: Object }>}
   */
  async getProcessesByIds(processIds) {
    if (!processIds || processIds.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('processes')
      .select('id, name, code, description, status')
      .in('id', processIds);

    return { data: data || [], error };
  }

  /**
   * Count active employee assignments referencing a specific brand and process
   * @param {string} brandId
   * @param {string} processId
   * @returns {Promise<number>}
   */
  async countActiveAssignmentsForProcess(brandId, processId) {
    const { count, error } = await supabase
      .from('employee_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('process_id', processId);

    if (error) return 0;
    return count || 0;
  }

  /**
   * Count active working rules referencing a specific brand and process
   * @param {string} brandId
   * @param {string} processId
   * @returns {Promise<number>}
   */
  async countActiveWorkingRulesForProcess(brandId, processId) {
    const { count, error } = await supabase
      .from('working_rules')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('process_id', processId)
      .eq('is_active', true);

    if (error) return 0;
    return count || 0;
  }

  /**
   * Check if brand_processes table exists in live schema
   * @returns {Promise<boolean>}
   */
  async checkBrandProcessesTableExists() {
    try {
      const { error } = await supabase.from('brand_processes').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Retrieve brand process records from brand_processes table if available
   * @param {string} brandId
   * @returns {Promise<Array>}
   */
  async getBrandProcessesFromTable(brandId) {
    try {
      const tableExists = await this.checkBrandProcessesTableExists();
      if (!tableExists) return [];
      const { data, error } = await supabase
        .from('brand_processes')
        .select('process_id')
        .eq('brand_id', brandId);
      if (error) return [];
      return data || [];
    } catch {
      return [];
    }
  }

  /**
   * Sync process IDs to brand_processes table if table exists
   * @param {string} brandId
   * @param {string[]} processIds
   */
  async syncBrandProcessesTable(brandId, processIds) {
    try {
      const tableExists = await this.checkBrandProcessesTableExists();
      if (!tableExists) return;

      await supabase.from('brand_processes').delete().eq('brand_id', brandId);
      if (processIds && processIds.length > 0) {
        const rows = processIds.map((pid) => ({ brand_id: brandId, process_id: pid }));
        await supabase.from('brand_processes').insert(rows);
      }
    } catch {
      // Non-blocking fallback
    }
  }
  /**
   * Permanently delete a brand record by ID
   * @param {string} id
   * @returns {Promise<{ error: Object }>}
   */
  async delete(id) {
    const { error } = await supabase
      .from('brands')
      .delete()
      .eq('id', id);

    return { error };
  }
}

export const brandRepository = new BrandRepository();
export default brandRepository;

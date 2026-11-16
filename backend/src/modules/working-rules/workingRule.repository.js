import { supabase } from '../../config/supabase.js';

/**
 * Working Rule Repository
 * Handles direct Supabase database operations for working_rules table.
 */
class WorkingRuleRepository {
  async create(ruleData) {
    const { data, error } = await supabase
      .from('working_rules')
      .insert([ruleData])
      .select(`
        *,
        brand:brands(id, name, status),
        process:processes(id, code, name, status)
      `)
      .single();

    return { data, error };
  }

  async findAll({ page = 1, limit = 10, brand_id, process_id, is_active, target_date }) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('working_rules')
      .select(`
        *,
        brand:brands(id, name, status),
        process:processes(id, code, name, status)
      `, { count: 'exact' });

    if (brand_id) query = query.eq('brand_id', brand_id);
    if (process_id) query = query.eq('process_id', process_id);
    if (is_active !== undefined && is_active !== null) {
      query = query.eq('is_active', is_active);
    }
    if (target_date) {
      query = query
        .lte('effective_from', target_date)
        .or(`effective_to.is.null,effective_to.gte.${target_date}`);
    }

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;
    return { data: data || [], count: count || 0, error };
  }

  async findById(id) {
    const { data, error } = await supabase
      .from('working_rules')
      .select(`
        *,
        brand:brands(id, name, status),
        process:processes(id, code, name, status)
      `)
      .eq('id', id)
      .maybeSingle();

    return { data, error };
  }

  async findActiveRule(brandId, processId, targetDate = new Date().toISOString().split('T')[0]) {
    const { data, error } = await supabase
      .from('working_rules')
      .select('*')
      .eq('brand_id', brandId)
      .eq('process_id', processId)
      .eq('is_active', true)
      .lte('effective_from', targetDate)
      .or(`effective_to.is.null,effective_to.gte.${targetDate}`)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    return { data, error };
  }

  async update(id, updateData) {
    const { data, error } = await supabase
      .from('working_rules')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        brand:brands(id, name, status),
        process:processes(id, code, name, status)
      `)
      .single();

    return { data, error };
  }

  async delete(id) {
    const { data, error } = await supabase
      .from('working_rules')
      .delete()
      .eq('id', id)
      .select()
      .maybeSingle();

    return { data, error };
  }

  async checkBrandExists(brandId) {
    const { data, error } = await supabase
      .from('brands')
      .select('id, name, status')
      .eq('id', brandId)
      .maybeSingle();

    return { data, error };
  }

  async checkProcessExists(processId) {
    const { data, error } = await supabase
      .from('processes')
      .select('id, name, status')
      .eq('id', processId)
      .maybeSingle();

    return { data, error };
  }
}

export const workingRuleRepository = new WorkingRuleRepository();
export default workingRuleRepository;

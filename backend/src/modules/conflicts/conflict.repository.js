import { supabase } from '../../config/supabase.js';

/**
 * Conflict Repository
 * Handles direct Supabase database operations for roster_conflicts table.
 */
class ConflictRepository {
  async createConflict(data) {
    const { data: record, error } = await supabase
      .from('roster_conflicts')
      .insert([data])
      .select('*, brand:brands(id, name), process:processes(id, code, name), roster:rosters(id, month, year, version, status)')
      .single();
    return { data: record, error };
  }

  async createConflictsBulk(conflicts) {
    if (!conflicts || conflicts.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('roster_conflicts')
      .insert(conflicts)
      .select('*, brand:brands(id, name), process:processes(id, code, name), roster:rosters(id, month, year, version, status)');
    return { data: data || [], error };
  }

  async findConflicts({ page = 1, limit = 50, roster_id, severity, status, conflict_type, brand_id, process_id }) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('roster_conflicts')
      .select('*, brand:brands(id, name), process:processes(id, code, name), roster:rosters(id, month, year, version, status)', { count: 'exact' });

    if (roster_id) query = query.eq('roster_id', roster_id);
    if (severity) query = query.eq('severity', severity);
    if (status) query = query.eq('status', status);
    if (conflict_type) query = query.eq('conflict_type', conflict_type);
    if (brand_id) query = query.eq('brand_id', brand_id);
    if (process_id) query = query.eq('process_id', process_id);

    query = query.order('conflict_date', { ascending: true }).range(from, to);
    const { data, count, error } = await query;
    return { data: data || [], count: count || 0, error };
  }

  async findConflictById(id) {
    const { data, error } = await supabase
      .from('roster_conflicts')
      .select('*, brand:brands(id, name), process:processes(id, code, name), roster:rosters(id, month, year, version, status)')
      .eq('id', id)
      .maybeSingle();
    return { data, error };
  }

  async updateConflict(id, updateData) {
    const { data, error } = await supabase
      .from('roster_conflicts')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, brand:brands(id, name), process:processes(id, code, name), roster:rosters(id, month, year, version, status)')
      .single();
    return { data, error };
  }

  async deleteOpenConflictsForRoster(rosterId) {
    const { data, error } = await supabase
      .from('roster_conflicts')
      .delete()
      .eq('roster_id', rosterId)
      .eq('status', 'OPEN');
    return { data, error };
  }
}

export const conflictRepository = new ConflictRepository();
export default conflictRepository;

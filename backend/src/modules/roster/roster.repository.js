import { supabase } from '../../config/supabase.js';

/**
 * Roster Repository
 * Handles direct Supabase database interactions for rosters and roster_entries tables.
 */
class RosterRepository {
  async createRoster(data) {
    const { data: record, error } = await supabase
      .from('rosters')
      .insert([data])
      .select('*, creator:employees(id, full_name)')
      .single();
    return { data: record, error };
  }

  async findRosterByMonthYear(month, year) {
    const { data, error } = await supabase
      .from('rosters')
      .select('*')
      .eq('month', month)
      .eq('year', year)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    return { data, error };
  }

  async findLatestRosterByMonthYear(month, year) {
    return this.findRosterByMonthYear(month, year);
  }

  /**
   * Concurrency-safe lookup or creation of roster header
   * - If existing roster is DRAFT or REVIEW, reuses it for regeneration.
   * - If existing roster is PUBLISHED, safely creates version (N+1) with DRAFT status.
   * - If no roster exists, attempts to insert version 1.
   * - Handles PostgreSQL 23505 unique constraint violation by re-fetching the committed roster.
   */
  async findOrCreateRosterHeader({ month, year, created_by }) {
    // 1. Look up the latest roster for the month and year
    const { data: latest, error: findErr } = await this.findLatestRosterByMonthYear(month, year);
    if (findErr) {
      return { data: null, isNewVersion: false, previousRoster: null, error: findErr };
    }

    // 2. If an existing roster was found
    if (latest) {
      if (latest.status === 'PUBLISHED') {
        const nextVersion = (parseInt(latest.version, 10) || 1) + 1;
        const { data: newVersionRoster, error: createErr } = await this.createRoster({
          month,
          year,
          version: nextVersion,
          status: 'DRAFT',
          created_by: created_by || null,
        });

        if (createErr) {
          if (createErr.code === '23505') {
            // Concurrency race: another request inserted nextVersion simultaneously
            const { data: refetched, error: refetchErr } = await this.findLatestRosterByMonthYear(month, year);
            if (refetchErr) return { data: null, isNewVersion: false, previousRoster: null, error: refetchErr };
            return {
              data: refetched,
              isNewVersion: refetched ? refetched.id !== latest.id : false,
              previousRoster: latest,
              error: null,
            };
          }
          return { data: null, isNewVersion: false, previousRoster: null, error: createErr };
        }

        return { data: newVersionRoster, isNewVersion: true, previousRoster: latest, error: null };
      }

      // Existing DRAFT or REVIEW roster: reuse in-place
      return { data: latest, isNewVersion: false, previousRoster: null, error: null };
    }

    // 3. No existing roster: create version 1
    const { data: created, error: createErr } = await this.createRoster({
      month,
      year,
      version: 1,
      status: 'DRAFT',
      created_by: created_by || null,
    });

    if (createErr) {
      // Concurrency race: another request inserted version 1 simultaneously
      if (createErr.code === '23505') {
        const { data: refetched, error: refetchErr } = await this.findLatestRosterByMonthYear(month, year);
        if (refetchErr) return { data: null, isNewVersion: false, previousRoster: null, error: refetchErr };
        return { data: refetched, isNewVersion: false, previousRoster: null, error: null };
      }
      return { data: null, isNewVersion: false, previousRoster: null, error: createErr };
    }

    return { data: created, isNewVersion: false, previousRoster: null, error: null };
  }

  async findAllRosters({ page = 1, limit = 20, year, month, status }) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('rosters')
      .select('*, creator:employees(id, full_name)', { count: 'exact' });

    if (year) query = query.eq('year', year);
    if (month) query = query.eq('month', month);
    if (status) query = query.eq('status', status);

    query = query
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .order('version', { ascending: false })
      .range(from, to);
    const { data, count, error } = await query;
    return { data: data || [], count: count || 0, error };
  }

  async findRosterById(id) {
    const { data, error } = await supabase
      .from('rosters')
      .select('*, creator:employees(id, full_name)')
      .eq('id', id)
      .maybeSingle();
    return { data, error };
  }

  async updateRoster(id, updateData) {
    const { data, error } = await supabase
      .from('rosters')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  }

  // ==========================================
  // Roster Entries
  // ==========================================
  async getRosterEntries(rosterId, { employee_id, brand_id, process_id } = {}) {
    let query = supabase
      .from('roster_entries')
      .select(`
        *,
        assignment:employee_assignments!inner(
          id,
          employee_id,
          brand_id,
          process_id,
          is_primary,
          employee:employees!inner(id, employee_code, full_name, designation, pod_id, employment_status),
          brand:brands!inner(id, name, status),
          process:processes!inner(id, code, name, status)
        )
      `)
      .eq('roster_id', rosterId);

    if (employee_id) query = query.eq('assignment.employee_id', employee_id);
    if (brand_id) query = query.eq('assignment.brand_id', brand_id);
    if (process_id) query = query.eq('assignment.process_id', process_id);

    query = query.order('work_date', { ascending: true });
    const { data, error } = await query;
    return { data: data || [], error };
  }

  async findEntryById(entryId) {
    const { data, error } = await supabase
      .from('roster_entries')
      .select('*, assignment:employee_assignments(*)')
      .eq('id', entryId)
      .maybeSingle();
    return { data, error };
  }

  async updateEntry(entryId, updateData) {
    const { data, error } = await supabase
      .from('roster_entries')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entryId)
      .select('*, assignment:employee_assignments(*)')
      .single();
    return { data, error };
  }

  async upsertEntries(entries) {
    // Upsert entries in batches of 200 for reliability
    const batchSize = 200;
    const results = [];
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('roster_entries')
        .upsert(batch, { onConflict: 'roster_id,assignment_id,work_date' })
        .select();

      if (error) {
        // Fallback: If composite conflict key is not defined, delete and insert non-manually edited
        return { data: null, error };
      }
      if (data) results.push(...data);
    }
    return { data: results, error: null };
  }

  async deleteNonManualEntries(rosterId) {
    const { data, error } = await supabase
      .from('roster_entries')
      .delete()
      .eq('roster_id', rosterId)
      .eq('is_manually_edited', false);
    return { data, error };
  }

  async insertEntriesBulk(entries) {
    const batchSize = 200;
    const results = [];
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('roster_entries')
        .insert(batch)
        .select();
      if (error) return { data: null, error };
      if (data) results.push(...data);
    }
    return { data: results, error: null };
  }

  // ==========================================
  // Context Gathering for Generation
  // ==========================================
  async getActiveAssignments() {
    const { data, error } = await supabase
      .from('employee_assignments')
      .select(`
        id,
        employee_id,
        brand_id,
        process_id,
        is_primary,
        employee:employees!inner(id, employee_code, full_name, employment_status, pod_id),
        brand:brands!inner(id, name, status),
        process:processes!inner(id, code, name, status)
      `)
      .eq('employee.employment_status', 'ACTIVE')
      .eq('brand.status', 'ACTIVE')
      .eq('process.status', 'ACTIVE');
    return { data: data || [], error };
  }

  async getActiveWorkingRules() {
    const { data, error } = await supabase
      .from('working_rules')
      .select('*')
      .eq('is_active', true);
    return { data: data || [], error };
  }

  async getActiveWeeklyOffs() {
    const { data, error } = await supabase
      .from('weekly_offs')
      .select('*')
      .eq('is_active', true);
    return { data: data || [], error };
  }

  async getApprovedLeavesForMonth(startDate, endDate) {
    const { data, error } = await supabase
      .from('leaves')
      .select('*')
      .eq('status', 'APPROVED')
      .lte('start_date', endDate)
      .gte('end_date', startDate);
    return { data: data || [], error };
  }

  async getApprovedCompOffsForMonth(startDate, endDate) {
    const { data, error } = await supabase
      .from('comp_offs')
      .select('*')
      .eq('status', 'APPROVED')
      .gte('off_date', startDate)
      .lte('off_date', endDate);
    return { data: data || [], error };
  }

  async getHolidaysForMonth(startDate, endDate) {
    const { data, error } = await supabase
      .from('public_holidays')
      .select('*')
      .eq('is_active', true)
      .gte('holiday_date', startDate)
      .lte('holiday_date', endDate);
    return { data: data || [], error };
  }

  async findActiveCycle() {
    const { data: published, error: pubErr } = await supabase
      .from('rosters')
      .select('*')
      .eq('status', 'PUBLISHED')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pubErr) return { data: null, error: pubErr };
    if (published) {
      return {
        data: {
          month: published.month,
          year: published.year,
          status: published.status,
          roster_id: published.id,
        },
        error: null,
      };
    }

    const { data: latest, error: latErr } = await supabase
      .from('rosters')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latErr) return { data: null, error: latErr };
    if (latest) {
      return {
        data: {
          month: latest.month,
          year: latest.year,
          status: latest.status,
          roster_id: latest.id,
        },
        error: null,
      };
    }

    return {
      data: {
        month: 12,
        year: 2026,
        status: 'NONE',
        roster_id: null,
      },
      error: null,
    };
  }
}

export const rosterRepository = new RosterRepository();
export default rosterRepository;

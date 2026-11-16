import { apiClient } from '../../../services/api/apiClient';

// In-flight promise cache to prevent simultaneous generation/grid requests
const inFlightRequests = new Map();

function deduplicate(key, asyncFn) {
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }
  const promise = asyncFn().finally(() => {
    inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, promise);
  return promise;
}

export const rosterService = {
  /**
   * Fetch roster grid for a specific year and month
   * Returns null if no roster exists (triggering UI Empty State)
   */
  async getRosterGrid(year, month) {
    const numYear = Number(year);
    const numMonth = Number(month);
    const key = `grid_${numYear}_${numMonth}`;

    return deduplicate(key, async () => {
      // 1. Check if a roster exists for year and month in Supabase
      const currentRoster = await this.getCurrentRoster(numYear, numMonth);

      if (!currentRoster?.id) {
        return null; // Return null so the UI can display the empty state!
      }

      // 2. Fetch structured 2D grid matrix from backend
      const entriesData = await apiClient.get(`/rosters/${currentRoster.id}/entries`);
      return entriesData.grid || {};
    });
  },

  /**
   * Update a single cell in the roster
   */
  async updateRosterCell(employeeId, dateKey, status, note = '', { rosterId, entryId } = {}) {
    const cleanStatus = status ? status.trim().toUpperCase().replace(/[\s-]/g, '_') : 'WORKING';

    // If entryId and rosterId are provided, update directly on backend
    if (rosterId && entryId) {
      return apiClient.put(`/rosters/${rosterId}/entries/${entryId}`, {
        status: cleanStatus,
        notes: note,
      });
    }

    // Otherwise locate the current roster and entry
    const [year, month] = dateKey.split('-').map((n) => parseInt(n, 10));
    const currentRoster = await this.getCurrentRoster(year, month);

    if (currentRoster?.id) {
      const entriesData = await apiClient.get(`/rosters/${currentRoster.id}/entries`, { employee_id: employeeId });
      const cell = entriesData.grid?.[employeeId]?.[dateKey];
      if (cell?.entry_id) {
        return apiClient.put(`/rosters/${currentRoster.id}/entries/${cell.entry_id}`, {
          status: cleanStatus,
          notes: note,
        });
      }
    }

    throw new Error(`Roster entry not found in database for employee ${employeeId} on ${dateKey}`);
  },

  /**
   * Explicitly generate or regenerate a roster
   */
  async generateRoster(year, month) {
    const numYear = Number(year);
    const numMonth = Number(month);
    const key = `gen_${numYear}_${numMonth}`;

    return deduplicate(key, async () => {
      const result = await apiClient.post('/rosters/generate', {
        year: numYear,
        month: numMonth,
      });

      if (result.roster?.id) {
        const entriesData = await apiClient.get(`/rosters/${result.roster.id}/entries`);
        return {
          roster: result.roster,
          grid: entriesData.grid || {},
          entries: entriesData.entries || [],
        };
      }
      return { roster: null, grid: {}, entries: [] };
    });
  },

  /**
   * Reset / regenerate baseline roster
   */
  async resetRoster(year, month) {
    return this.generateRoster(year, month);
  },

  /**
   * Trigger backend conflict validation
   */
  async validateRoster({ year, month }) {
    const numYear = Number(year);
    const numMonth = Number(month);
    const currentRoster = await this.getCurrentRoster(numYear, numMonth);

    if (!currentRoster?.id) return [];

    const validationResult = await apiClient.post(`/conflicts/validate/${currentRoster.id}`, {});
    return validationResult.conflicts || [];
  },

  /**
   * Fetch current roster entity for a given year and month
   */
  async getCurrentRoster(year, month) {
    const numYear = Number(year);
    const numMonth = Number(month);
    const rostersResponse = await apiClient.get('/rosters', { year: numYear, month: numMonth });
    const rosters = Array.isArray(rostersResponse) ? rostersResponse : rostersResponse.rosters || [];
    return rosters.find((r) => Number(r.year) === numYear && Number(r.month) === numMonth) || null;
  },

  /**
   * Update roster status (e.g. REVIEW or PUBLISHED)
   */
  async updateRosterStatus(rosterId, status = 'PUBLISHED') {
    return apiClient.patch(`/rosters/${rosterId}/status`, { status });
  },

  /**
   * Publish roster
   */
  async publishRoster(rosterId) {
    return this.updateRosterStatus(rosterId, 'PUBLISHED');
  },
};

export default rosterService;

import { rosterRepository } from '../roster/roster.repository.js';
import { conflictRepository } from '../conflicts/conflict.repository.js';
import { assignmentRepository } from '../assignments/assignment.repository.js';
import { AppError } from '../../utils/appError.js';

class ExportService {
  /**
   * Export monthly roster to CSV string
   */
  async exportRosterToCSV(rosterId) {
    const { data: roster } = await rosterRepository.findRosterById(rosterId);
    if (!roster) throw new AppError('Roster not found', 404);

    const { data: entries } = await rosterRepository.getRosterEntries(rosterId);
    if (!entries || entries.length === 0) {
      throw new AppError('No roster entries found to export', 404);
    }

    const headers = [
      'Work Date',
      'Employee Code',
      'Employee Name',
      'Brand',
      'Process',
      'Shift Status',
      'Manually Edited',
      'Notes',
    ];

    const rows = entries.map((e) => [
      e.work_date,
      `"${e.assignment?.employee?.employee_code || ''}"`,
      `"${e.assignment?.employee?.full_name || ''}"`,
      `"${e.assignment?.brand?.name || ''}"`,
      `"${e.assignment?.process?.name || ''}"`,
      e.status,
      e.is_manually_edited ? 'YES' : 'NO',
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const filename = `DataStraw_Roster_${roster.year}_${String(roster.month).padStart(2, '0')}.csv`;

    return { csvContent, filename };
  }

  /**
   * Export conflicts to CSV string
   */
  async exportConflictsToCSV(query = {}) {
    const { data: conflicts } = await conflictRepository.findConflicts({ ...query, limit: 1000 });
    const headers = [
      'Conflict Date',
      'Severity',
      'Type',
      'Brand',
      'Process',
      'Required Staff',
      'Available Staff',
      'Description',
      'Suggested Resolution',
      'Status',
    ];

    const rows = (conflicts || []).map((c) => [
      c.conflict_date || 'N/A',
      c.severity,
      c.conflict_type,
      `"${c.brand?.name || 'All'}"`,
      `"${c.process?.name || 'All'}"`,
      c.required_staff_count ?? 'N/A',
      c.available_staff_count ?? 'N/A',
      `"${(c.description || '').replace(/"/g, '""')}"`,
      `"${(c.suggested_resolution || '').replace(/"/g, '""')}"`,
      c.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const filename = `DataStraw_Conflicts_${new Date().toISOString().split('T')[0]}.csv`;
    return { csvContent, filename };
  }

  /**
   * Export assignments to CSV string
   */
  async exportAssignmentsToCSV(query = {}) {
    const { data: assignments } = await assignmentRepository.findAll({ ...query, limit: 1000 });
    const headers = [
      'Employee Code',
      'Employee Name',
      'Designation',
      'Brand',
      'Process Code',
      'Process Name',
      'Is Primary',
      'Created At',
    ];

    const rows = (assignments || []).map((a) => [
      `"${a.employee?.employee_code || ''}"`,
      `"${a.employee?.full_name || ''}"`,
      `"${a.employee?.designation || ''}"`,
      `"${a.brand?.name || ''}"`,
      `"${a.process?.code || ''}"`,
      `"${a.process?.name || ''}"`,
      a.is_primary ? 'YES' : 'NO',
      a.created_at,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const filename = `DataStraw_Assignments_${new Date().toISOString().split('T')[0]}.csv`;
    return { csvContent, filename };
  }
}

export const exportService = new ExportService();
export default exportService;

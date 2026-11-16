import { conflictService } from './conflict.service.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';

class ConflictController {
  async getAllConflicts(req, res, next) {
    try {
      const { conflicts, pagination } = await conflictService.getAllConflicts(req.query);
      return paginatedResponse(res, conflicts, pagination, 'Conflicts retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async getConflictById(req, res, next) {
    try {
      const { id } = req.params;
      const conflict = await conflictService.getConflictById(id);
      return successResponse(res, conflict, 'Conflict retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async validateRoster(req, res, next) {
    try {
      const { rosterId } = req.params;
      const conflicts = await conflictService.validateRoster(rosterId);
      return successResponse(
        res,
        {
          total_conflicts: conflicts.length,
          critical_count: conflicts.filter((c) => c.severity === 'CRITICAL').length,
          warning_count: conflicts.filter((c) => c.severity === 'WARNING').length,
          info_count: conflicts.filter((c) => c.severity === 'INFO').length,
          conflicts,
        },
        'Roster conflict validation completed successfully',
        200
      );
    } catch (error) {
      next(error);
    }
  }

  async resolveConflict(req, res, next) {
    try {
      const { id } = req.params;
      const note = req.body?.resolution_note || null;
      const resolved = await conflictService.resolveConflict(id, note);
      return successResponse(res, resolved, 'Conflict marked as resolved', 200);
    } catch (error) {
      next(error);
    }
  }

  async resolveWithReplacement(req, res, next) {
    try {
      const { id } = req.params;
      const { replacement_employee_id, resolution_note } = req.body || {};
      const resolved = await conflictService.resolveWithReplacement(id, {
        replacementEmployeeId: replacement_employee_id,
        resolutionNote: resolution_note,
      });
      return successResponse(res, resolved, 'Conflict resolved with replacement employee', 200);
    } catch (error) {
      next(error);
    }
  }

  async ignoreConflict(req, res, next) {
    try {
      const { id } = req.params;
      const ignored = await conflictService.ignoreConflict(id);
      return successResponse(res, ignored, 'Conflict marked as ignored', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const conflictController = new ConflictController();
export default conflictController;

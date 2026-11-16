import { assignmentService } from './assignment.service.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';

class AssignmentController {
  async createAssignment(req, res, next) {
    try {
      const created = await assignmentService.createAssignment(req.body);
      const isBulk = Array.isArray(created);
      return successResponse(
        res,
        created,
        isBulk ? 'Assignments created successfully' : 'Assignment created successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  async getAllAssignments(req, res, next) {
    try {
      const { assignments, pagination } = await assignmentService.getAllAssignments(req.query);
      return paginatedResponse(res, assignments, pagination, 'Assignments retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async getAssignmentById(req, res, next) {
    try {
      const { id } = req.params;
      const assignment = await assignmentService.getAssignmentById(id);
      return successResponse(res, assignment, 'Assignment retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async updateAssignment(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await assignmentService.updateAssignment(id, req.body);
      return successResponse(res, updated, 'Assignment updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async deleteAssignment(req, res, next) {
    try {
      const { id } = req.params;
      const deleted = await assignmentService.deleteAssignment(id);
      return successResponse(res, deleted, 'Assignment deleted successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const assignmentController = new AssignmentController();
export default assignmentController;

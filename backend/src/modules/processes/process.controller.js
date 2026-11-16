import { processService } from './process.service.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';

class ProcessController {
  /**
   * POST /api/processes
   * Create a new process
   */
  async createProcess(req, res, next) {
    try {
      const createdProcess = await processService.createProcess(req.body);
      return successResponse(res, createdProcess, 'Process created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/processes
   * Retrieve all processes with optional search, status filter, and pagination
   */
  async getAllProcesses(req, res, next) {
    try {
      const { processes, pagination } = await processService.getAllProcesses(req.query);
      return paginatedResponse(res, processes, pagination, 'Processes retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/processes/:id
   * Retrieve a process by ID
   */
  async getProcessById(req, res, next) {
    try {
      const { id } = req.params;
      const processItem = await processService.getProcessById(id);
      return successResponse(res, processItem, 'Process retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/processes/:id
   * Update process details
   */
  async updateProcess(req, res, next) {
    try {
      const { id } = req.params;
      const updatedProcess = await processService.updateProcess(id, req.body);
      return successResponse(res, updatedProcess, 'Process updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/processes/:id
   * Soft-deactivate or permanently delete a process
   */
  async deactivateProcess(req, res, next) {
    try {
      const { id } = req.params;
      const permanent = req.query.permanent === 'true';
      const result = await processService.deleteProcess(id, { permanent });
      const message = result?.deleted
        ? `Process '${result.name}' permanently deleted successfully`
        : 'Process deactivated successfully';
      return successResponse(res, result, message, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/processes/:id - alias for deactivateProcess
   */
  async deleteProcess(req, res, next) {
    return this.deactivateProcess(req, res, next);
  }
}

export const processController = new ProcessController();
export default processController;

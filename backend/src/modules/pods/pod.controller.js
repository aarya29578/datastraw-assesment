import { podService } from './pod.service.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';

class PodController {
  /**
   * POST /api/pods
   * Create a new pod
   */
  async createPod(req, res, next) {
    try {
      const createdPod = await podService.createPod(req.body);
      return successResponse(res, createdPod, 'Pod created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/pods
   * Retrieve all pods with optional search and pagination
   */
  async getAllPods(req, res, next) {
    try {
      const { pods, pagination } = await podService.getAllPods(req.query);
      return paginatedResponse(res, pods, pagination, 'Pods retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/pods/:id
   * Retrieve a pod by ID
   */
  async getPodById(req, res, next) {
    try {
      const { id } = req.params;
      const pod = await podService.getPodById(id);
      return successResponse(res, pod, 'Pod retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/pods/:id
   * Update pod details
   */
  async updatePod(req, res, next) {
    try {
      const { id } = req.params;
      const updatedPod = await podService.updatePod(id, req.body);
      return successResponse(res, updatedPod, 'Pod updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/pods/:id
   * Delete or deactivate a pod
   */
  async deletePod(req, res, next) {
    try {
      const { id } = req.params;
      const deletedPod = await podService.deletePod(id);
      return successResponse(res, deletedPod, 'Pod deleted successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const podController = new PodController();
export default podController;

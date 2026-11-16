import { dashboardService } from './dashboard.service.js';
import { successResponse } from '../../utils/response.js';

class DashboardController {
  async getMetrics(req, res, next) {
    try {
      const data = await dashboardService.getMetrics();
      return successResponse(res, data, 'Dashboard metrics retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async getOverview(req, res, next) {
    try {
      const data = await dashboardService.getOverview();
      return successResponse(res, data, 'Dashboard overview retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();
export default dashboardController;

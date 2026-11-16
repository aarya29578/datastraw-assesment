import { availabilityService } from './availability.service.js';
import { successResponse, paginatedResponse } from '../../utils/response.js';

class AvailabilityController {
  // 1. Weekly Offs
  async createWeeklyOff(req, res, next) {
    try {
      const created = await availabilityService.createWeeklyOff(req.body);
      return successResponse(res, created, 'Weekly off configured successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getAllWeeklyOffs(req, res, next) {
    try {
      const { weekly_offs, pagination } = await availabilityService.getAllWeeklyOffs(req.query);
      return paginatedResponse(res, weekly_offs, pagination, 'Weekly offs retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async getWeeklyOffById(req, res, next) {
    try {
      const { id } = req.params;
      const data = await availabilityService.getWeeklyOffById(id);
      return successResponse(res, data, 'Weekly off retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async updateWeeklyOff(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await availabilityService.updateWeeklyOff(id, req.body);
      return successResponse(res, updated, 'Weekly off updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async deleteWeeklyOff(req, res, next) {
    try {
      const { id } = req.params;
      const deleted = await availabilityService.deleteWeeklyOff(id);
      return successResponse(res, deleted, 'Weekly off deleted successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  // 2. Leaves
  async createLeave(req, res, next) {
    try {
      const created = await availabilityService.createLeave(req.body);
      return successResponse(res, created, 'Leave request submitted successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getAllLeaves(req, res, next) {
    try {
      const { leaves, pagination } = await availabilityService.getAllLeaves(req.query);
      return paginatedResponse(res, leaves, pagination, 'Leaves retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async getLeaveById(req, res, next) {
    try {
      const { id } = req.params;
      const data = await availabilityService.getLeaveById(id);
      return successResponse(res, data, 'Leave retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async updateLeave(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await availabilityService.updateLeave(id, req.body);
      return successResponse(res, updated, 'Leave updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async approveLeave(req, res, next) {
    try {
      const { id } = req.params;
      const approverId = req.body?.approved_by || null;
      const updated = await availabilityService.setLeaveStatus(id, 'APPROVED', approverId);
      return successResponse(res, updated, 'Leave request approved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async rejectLeave(req, res, next) {
    try {
      const { id } = req.params;
      const approverId = req.body?.approved_by || null;
      const updated = await availabilityService.setLeaveStatus(id, 'REJECTED', approverId);
      return successResponse(res, updated, 'Leave request rejected successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async cancelLeave(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await availabilityService.setLeaveStatus(id, 'CANCELLED');
      return successResponse(res, updated, 'Leave request cancelled successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  // 3. Comp-Offs
  async createCompOff(req, res, next) {
    try {
      const created = await availabilityService.createCompOff(req.body);
      return successResponse(res, created, 'Comp-off recorded successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getAllCompOffs(req, res, next) {
    try {
      const { comp_offs, pagination } = await availabilityService.getAllCompOffs(req.query);
      return paginatedResponse(res, comp_offs, pagination, 'Comp-offs retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async getCompOffById(req, res, next) {
    try {
      const { id } = req.params;
      const data = await availabilityService.getCompOffById(id);
      return successResponse(res, data, 'Comp-off retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async updateCompOff(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await availabilityService.updateCompOff(id, req.body);
      return successResponse(res, updated, 'Comp-off updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async approveCompOff(req, res, next) {
    try {
      const { id } = req.params;
      const approverId = req.body?.approved_by || null;
      const updated = await availabilityService.setCompOffStatus(id, 'APPROVED', approverId);
      return successResponse(res, updated, 'Comp-off approved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async rejectCompOff(req, res, next) {
    try {
      const { id } = req.params;
      const approverId = req.body?.approved_by || null;
      const updated = await availabilityService.setCompOffStatus(id, 'REJECTED', approverId);
      return successResponse(res, updated, 'Comp-off rejected successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  // 4. Public Holidays
  async createHoliday(req, res, next) {
    try {
      const created = await availabilityService.createHoliday(req.body);
      return successResponse(res, created, 'Public holiday created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getAllHolidays(req, res, next) {
    try {
      const { holidays, pagination } = await availabilityService.getAllHolidays(req.query);
      return paginatedResponse(res, holidays, pagination, 'Public holidays retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async getHolidayById(req, res, next) {
    try {
      const { id } = req.params;
      const data = await availabilityService.getHolidayById(id);
      return successResponse(res, data, 'Public holiday retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async updateHoliday(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await availabilityService.updateHoliday(id, req.body);
      return successResponse(res, updated, 'Public holiday updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async deleteHoliday(req, res, next) {
    try {
      const { id } = req.params;
      const deleted = await availabilityService.deleteHoliday(id);
      return successResponse(res, deleted, 'Public holiday deleted successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const availabilityController = new AvailabilityController();
export default availabilityController;
